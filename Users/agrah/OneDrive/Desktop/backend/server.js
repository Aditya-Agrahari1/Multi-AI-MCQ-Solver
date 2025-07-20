import express from 'express';
import cors from 'cors';
import bodyParser from 'body-parser';
import fetch from 'node-fetch';
import rateLimit from 'express-rate-limit';
import crypto from 'crypto';

const app = express();
app.use(cors({
  origin: ['http://localhost:8080', 'http://localhost:3000'],
  credentials: true
}));
app.use(bodyParser.json());

// API Configuration
const INFIP_API_URL = 'https://api.infip.pro/v1/images/generations';
const INFIP_API_KEY = 'infip-dddf9d2b';
const VASARAI_API_URL = 'https://midapi.vasarai.net/api/v1/images/generate-image';
const VASARAI_API_KEY = 'vasarai'; // Your VasarAI Bearer token
const API_SECRET = process.env.API_SECRET || '9upuur2ru'; // Hard-coded for testing
console.log('API_SECRET set to:', API_SECRET); // Debug log

// Secure token-based image storage
const imageTokens = new Map(); // In production, use Redis with TTL
const TOKEN_EXPIRY = 1000 * 60 * 30; // 30 minutes

const imageGenerationLimiter = rateLimit({
  windowMs: 3 * 1000,
  max: 1,
  message: { error: 'You can only generate 1 image every 3 seconds. Please wait.' },
  standardHeaders: true,
  legacyHeaders: false
});

const secureProxyLimiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minute
  max: 100, // Higher limit since it's now secured
  message: { error: 'Too many requests, please slow down.' }
});

const authenticateRequest = (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || authHeader !== `Bearer ${API_SECRET}`) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  next();
};

// Generate secure token for image access
const generateImageToken = (originalUrl) => {
  const token = crypto.randomBytes(32).toString('hex');
  const expiresAt = Date.now() + TOKEN_EXPIRY;
  
  imageTokens.set(token, {
    originalUrl,
    expiresAt,
    accessCount: 0,
    maxAccess: 10 // Limit how many times token can be used
  });
  
  // Auto-cleanup expired tokens
  setTimeout(() => {
    imageTokens.delete(token);
  }, TOKEN_EXPIRY);
  
  return token;
};

// Validate and get original URL from token
const validateImageToken = (token) => {
  const tokenData = imageTokens.get(token);
  
  if (!tokenData) {
    return { valid: false, error: 'Invalid or expired token' };
  }
  
  if (Date.now() > tokenData.expiresAt) {
    imageTokens.delete(token);
    return { valid: false, error: 'Token expired' };
  }
  
  if (tokenData.accessCount >= tokenData.maxAccess) {
    return { valid: false, error: 'Token access limit exceeded' };
  }
  
  tokenData.accessCount++;
  return { valid: true, originalUrl: tokenData.originalUrl };
};

// VasarAI Image Generation Function
async function generateVasarAIImage(prompt, style = 'cinematic') {
  const apiUrl = `${VASARAI_API_URL}?message=${encodeURIComponent(prompt)}&style=${style}`;
  
  try {
    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'accept': 'application/json',
        'Authorization': `Bearer ${VASARAI_API_KEY}`
      },
      body: ''
    });

    const data = await response.json();
    
    if (!response.ok) {
      throw new Error(`VasarAI API error: ${response.status} - ${data.detail || 'Unknown error'}`);
    }

    // VasarAI returns: {"cdn_url":"https://cdn.snapzion.com/workspace-.../image.png"}
    if (!data.cdn_url) {
      throw new Error('No CDN URL returned from VasarAI API');
    }

    return {
      data: [{
        url: data.cdn_url,
        revised_prompt: prompt // VasarAI doesn't seem to return revised prompts
      }]
    };

  } catch (error) {
    console.error('VasarAI generation error:', error);
    throw error;
  }
}

app.post('/api/generate-image', 
  imageGenerationLimiter,
  // authenticateRequest, // TEMPORARILY DISABLED for testing
  async (req, res) => {
    try {
      const { model, prompt, n = 1, response_format = "url", size = "1024x1024", style = "cinematic" } = req.body;

      if (!prompt || typeof prompt !== 'string' || prompt.trim().length === 0) {
        return res.status(400).json({ error: 'Valid prompt is required' });
      }

      if (prompt.length > 1000) {
        return res.status(400).json({ error: 'Prompt too long (max 1000 characters)' });
      }

      let data;

      // Log only the model being used
      console.log(`Image generation requested. Model: ${model}`);

      // Check if it's a VasarAI model
      if (model === 'vasarai' || model === 'midjourney') {
        data = await generateVasarAIImage(prompt.trim(), style);
      } else {
        // Use existing Infip API for other models
        const infipRes = await fetch(INFIP_API_URL, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${INFIP_API_KEY}`
          },
          body: JSON.stringify({ model, prompt: prompt.trim(), n, response_format, size })
        });

        const rawText = await infipRes.text();

        try {
          data = JSON.parse(rawText);
        } catch (e) {
          return res.status(502).json({ error: "Invalid JSON from Infip API" });
        }

        if (!infipRes.ok) {
          return res.status(infipRes.status).json(data);
        }
      }

      // Replace direct URLs with secure tokens
      if (data.data && Array.isArray(data.data)) {
        data.data = data.data.map(item => {
          if (item.url) {
            const token = generateImageToken(item.url);
            const secureUrl = `/api/secure-image/${token}`;
            return {
              ...item,
              url: secureUrl, // Secure token-based URL
              token // Include token for frontend reference if needed
            };
          }
          return item;
        });
      }

      res.json(data);
    } catch (err) {
      console.error('Image generation error:', err);
      res.status(500).json({ 
        error: 'Internal server error', 
        details: err.message || 'Unknown error occurred' 
      });
    }
  }
);

// NEW: Secure token-based image access endpoint
app.get('/api/secure-image/:token', 
  secureProxyLimiter,
  // authenticateRequest, // TEMPORARILY DISABLED for testing
  async (req, res) => {
    try {
      const { token } = req.params;
      
      if (!token || typeof token !== 'string') {
        return res.status(400).json({ error: 'Invalid token' });
      }
      
      const validation = validateImageToken(token);
      if (!validation.valid) {
        return res.status(403).json({ error: validation.error });
      }
      
      // Additional security: validate the original URL domain
      const allowedDomains = ['api.infip.pro', 'cdn.snapzion.com']; // Added VasarAI domain
      const urlObj = new URL(validation.originalUrl);
      
      if (!allowedDomains.includes(urlObj.hostname)) {
        return res.status(403).json({ error: 'Unauthorized domain' });
      }
      
      const imageResponse = await fetch(validation.originalUrl, {
        timeout: 10000
      });
      
      if (!imageResponse.ok) {
        return res.status(404).json({ error: 'Image not accessible' });
      }
      
      const contentType = imageResponse.headers.get('content-type');
      if (!contentType || !contentType.startsWith('image/')) {
        return res.status(400).json({ error: 'Not an image' });
      }
      
      res.set({
        'Content-Type': contentType,
        'Content-Length': imageResponse.headers.get('content-length'),
        'Cache-Control': 'private, max-age=3600', // Private cache
        'X-Content-Type-Options': 'nosniff',
      });
      
      imageResponse.body.pipe(res);
      
    } catch (error) {
      console.error('Secure image access error:', error);
      res.status(500).json({ error: 'Failed to access image' });
    }
  }
);

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({ status: 'OK', timestamp: new Date().toISOString() });
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`Secure backend running on port ${PORT}`);
  console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
});