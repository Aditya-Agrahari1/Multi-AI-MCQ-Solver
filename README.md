# GetAnswers - AI Test Helper 🧠✨

Your ultimate companion for online quizzes and tests. Get instant, consensus-based answers from multiple leading AI models, directly on any webpage. This extension is designed for speed, accuracy, and a professional user experience.



## 🚀 Core Features

* **Multi-Model Analysis:** Don't rely on a single AI. GetAnswers queries multiple models (including GPT-4.1, Mistral, and Llama-4) for each question to ensure the highest accuracy.
* **Consensus-Based Answers:** The "Majority" vote shows you the most likely correct answer based on the consensus of the AI models, giving you a higher degree of confidence.
* **Works on Any Site:** Designed to be a general-purpose tool for any educational platform, e-learning site, or article containing multiple-choice questions.

---

## 💡 Smart & Efficient

* **One-Click Auto-Fill:** The "Apply Answers to Page" button automatically selects the correct radio buttons on the webpage, saving you time and effort during timed tests.
* **Bypasses Copy/Paste Restrictions:** Many test sites disable copy and paste. Our extension reads the content directly from the page, working seamlessly even when these restrictions are in place.
* **Intelligent Pre-screening:** An intelligent "Bouncer" function quickly analyzes the page structure. If it doesn't look like a quiz, it won't waste your valuable AI credits, saving you money and time.
* **Definitive Caching:** The backend uses a sophisticated caching system that recognizes previously seen quizzes, even if the question order is different, providing instant results and further reducing API costs.

---

## ✨ Professional UI/UX

* **At-a-Glance Confidence Scores:** Rows are highlighted in green (unanimous agreement) or amber (split decision), so you can instantly see how confident the AIs are in an answer.
* **Clear Disagreement Highlighting:** Dissenting answers are de-emphasized, allowing you to quickly spot which model disagreed with the majority without causing alarm.
* **Optimized for Speed:** The UI is designed for users under pressure. The most important information, the final majority answer, is made visually prominent with a larger font and a bright green background.
* **Keyboard Shortcut:** Open and close the sidebar instantly with a keyboard shortcut (**Alt+S**), with a helpful tooltip on the open/close tabs to remind you.
* **Polished Details:** From the animated summary border to the clean, professional dark mode, every detail is designed to create a smooth and intuitive experience.

---

## 🛠️ How It Works (Technical Overview)

This extension is a full-stack application with a robust, scalable backend deployed on Render.

1.  **Frontend:** A browser extension with a UI built with HTML, CSS, and JavaScript. It reads page content and communicates with the backend.
2.  **Backend API:** A FastAPI server acts as a lightweight "receptionist." It accepts requests from the extension and places them into a job queue.
3.  **Job Queue (Redis):** A Redis instance manages the queue of incoming requests, ensuring that the system can handle a sudden rush of users without crashing.
4.  **Parallel Workers:** Multiple Python background workers (running in parallel) pull jobs from the queue. Each worker is responsible for the heavy lifting: pre-screening, caching, and calling the Mistral AI API to parse questions. This decoupled architecture ensures the system is both fast and resilient.

---

## 📦 Installation

1.  Install the extension from the **[Chrome Web Store](https://chromewebstore.google.com/)**.
2.  Pin the extension to your toolbar for easy access.

---

## 🚀 Usage

1.  Navigate to a webpage containing a multiple-choice quiz.
2.  Open the sidebar by clicking the extension icon in your toolbar or by pressing **Alt+S**.
3.  Click the **"Analyze Questions"** button.
4.  Review the consensus-based answers.
5.  (Optional) Click the **"Apply Answers to Page"** button to automatically select the answers on the page.

---

## 📜 License

This project is licensed under the MIT License.
