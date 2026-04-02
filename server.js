process.on('uncaughtException', (err) => {
    console.error('Uncaught Exception:', err);
});
process.on('unhandledRejection', (reason, promise) => {
    console.error('Unhandled Rejection:', reason);
});
require('dotenv').config();
console.log('DEEPSEEK_API_KEY:', process.env.DEEPSEEK_API_KEY ? '已加载' : '未加载');
const express = require('express');
const cors = require('cors');
const OpenAI = require('openai');

const app = express();
app.use(cors());
app.use(express.json());
app.get('/test', (req, res) => {
    res.json({ message: 'Backend is alive' });
});
// 初始化 DeepSeek (使用 OpenAI 兼容接口)
const client = new OpenAI({
    baseURL: 'https://api.deepseek.com/v1',
    apiKey: process.env.DEEPSEEK_API_KEY,  // 从 .env 文件读取
});

// 1. 评估单个急救方法
app.post('/api/evaluate-method', async (req, res) => {
    const { method } = req.body;
    if (!method) return res.status(400).json({ error: 'Method required' });

    const prompt = `You are a professional first aid doctor. Evaluate the following burn treatment method: "${method}". 
    Determine if it is correct and safe according to modern first aid guidelines. 
    Respond in JSON format: {"correct": true/false, "reason": "short educational explanation (max 2 sentences)"}.
    If correct, give positive feedback. If incorrect, explain why it's dangerous or ineffective.`;

    try {
        const completion = await client.chat.completions.create({
            model: 'deepseek-chat',
            messages: [{ role: 'user', content: prompt }],
            temperature: 0.3,
            response_format: { type: 'json_object' }
        });
        const result = JSON.parse(completion.choices[0].message.content);
        res.json(result);
    } catch (error) {
        console.error(error);
        res.status(500).json({ correct: false, reason: "AI service error. Please try again." });
    }
});

// 2. 评估急救步骤顺序
app.post('/api/evaluate-order', async (req, res) => {
    const { patientType, steps } = req.body;
    if (!patientType || !steps) return res.status(400).json({ error: 'Missing data' });

    let degreeText = '';
    if (patientType === 'first') degreeText = 'First-degree burn (superficial, only top layer)';
    else if (patientType === 'second') degreeText = 'Second-degree burn (blisters, deep partial thickness)';
    else degreeText = 'Third-degree burn (full thickness, may be painless, needs hospital)';

    const prompt = `You are a first aid expert. A student has selected a patient with ${degreeText}.
    They performed the following steps in this order: ${steps.join(' → ')}.
    According to standard burn first aid (cool water → dry gently → cover clean cloth → for 2nd/3rd degree: hospital immediately), 
    evaluate if the steps are correct in order and completeness.
    Respond in JSON: {"success": true/false, "feedback": "explain what is wrong or congratulate if correct, max 2 sentences"}.`;

    try {
        const completion = await client.chat.completions.create({
            model: 'deepseek-chat',
            messages: [{ role: 'user', content: prompt }],
            temperature: 0.3,
            response_format: { type: 'json_object' }
        });
        const result = JSON.parse(completion.choices[0].message.content);
        res.json(result);
    } catch (error) {
        console.error(error);
        res.status(500).json({ success: false, feedback: "AI order check failed." });
    }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, '0.0.0.0', () => console.log(`Backend running on port ${PORT}`));