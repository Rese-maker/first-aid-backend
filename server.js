require('dotenv').config();
const express = require('express');
const cors = require('cors');
const OpenAI = require('openai');

const app = express();
app.use(cors());
app.use(express.json());

// 检查 API Key 是否存在（放在 dotenv 之后）
if (!process.env.DEEPSEEK_API_KEY) {
    console.error('FATAL: DEEPSEEK_API_KEY environment variable is not set.');
    process.exit(1);
}

console.log('DEEPSEEK_API_KEY is set. Starting server...');

// 初始化 DeepSeek 客户端
const client = new OpenAI({
    baseURL: 'https://api.deepseek.com/v1',
    apiKey: process.env.DEEPSEEK_API_KEY,
});

// 测试路由
app.get('/test', (req, res) => {
    res.json({ message: 'Backend is alive' });
});

// 1. 评估单个急救方法
app.post('/api/evaluate-method', async (req, res) => {
    const { method } = req.body;
    if (!method) return res.status(400).json({ error: 'Method required' });

    const prompt = `You are a professional first aid educator for high school students. 
Evaluate the following burn treatment method: "${method}".
Rules:
- Burn ointment (e.g., antibiotic cream) is safe to apply on unbroken skin (first-degree burns with no open wounds or blisters). If the skin is broken or blistered, do not apply ointment.
- Cool running water (not ice) for 10-20 minutes is correct for first-degree and some second-degree burns.
- Do not apply ice, butter, oil, toothpaste, or soy sauce.
- Do not pop blisters.
- If the method is partially correct depending on the situation (e.g., ointment), you may say "Partially correct: can be used on unbroken skin, but not on open wounds."
Respond in JSON: {"correct": true/false, "reason": "short educational explanation (1 sentence for high school students)"}.`;
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
        console.error('DeepSeek API error:', error);
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

    const prompt = `You are a first aid expert for high school students. 
Patient type: ${degreeText}.
Student's steps (in order): ${steps.join(' → ')}.

Rules for correct first aid:
- FIRST-DEGREE burn (red, dry, no blisters): Steps should include: cool water for 10-20 minutes, gently dry, remove clothing if not stuck, cover with clean cloth. Burn ointment is optional on unbroken skin. DO NOT require hospital.
- SECOND-DEGREE burn (blisters, wet): Do NOT apply ice. Cool water is acceptable. Cover loosely. Seek medical help if large area or on face/hands/feet. For school exercise, recommend hospital if serious.
- THIRD-DEGREE burn (black/white, charred, possibly painless): DO NOT apply water. Cover with clean cloth. Immediately go to hospital. Do not remove stuck clothing.

Also: Face burn: ensure breathing. Do not apply water if third-degree.

Evaluate if the student's sequence is appropriate for the given degree.
Respond in JSON: {"success": true/false, "feedback": "explain what is wrong or congratulate if correct, 1-2 sentences for high school students"}.`;
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
        console.error('DeepSeek API error:', error);
        res.status(500).json({ success: false, feedback: "AI order check failed." });
    }
});

// 监听端口（Railway 会提供 PORT 环境变量）
const PORT = process.env.PORT || 3000;
app.listen(PORT, '0.0.0.0', () => console.log(`Backend running on port ${PORT}`));