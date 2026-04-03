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

   const prompt = `You are a first aid educator for high school students.
The student proposes a method: "${method}".

RULES:
- If the method is "burn ointment", "antibiotic cream", "burn cream", or "烫伤膏": 
  Set "correct": true. 
  Reason: "Burn ointment can be used on unbroken skin for first-degree burns to soothe and prevent infection. Do not apply on broken skin, open blisters, or second/third-degree burns."
- If the method is "honey", "pure honey", or "medical honey":
  Set "correct": true.
  Reason: "Honey can be used ONLY on very mild first-degree burns with unbroken skin (e.g., slight sunburn). For severe burns or open wounds, honey is dangerous and may worsen infection. Never use honey on second/third-degree burns or broken skin."
- If the method is "cool water", "cool running water", "cool tap water":
  Set "correct": true. Reason: "Cool running water for 10-20 minutes is the correct first step for minor burns."
- If the method is dangerous (e.g., "butter", "oil", "ice directly", "toothpaste", "soy sauce", "pop blisters"):
  Set "correct": false. Reason: "This is dangerous because ..."
- For any other method, use your medical knowledge: if safe under standard first aid guidelines, set "correct": true and give a short reason with conditions if needed; if unsafe, set "correct": false.

Respond ONLY in valid JSON: {"correct": true/false, "reason": "one short sentence for high school students"}.`;
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
- FIRST-DEGREE burn (red, dry, no blisters): Acceptable steps: cool water, gently dry, remove clothing if not stuck, cover with clean cloth, apply burn ointment or honey (only on unbroken skin). Hospital not required.
- SECOND-DEGREE burn (blisters, wet): Do NOT apply ice or honey. Cool water is acceptable. Cover loosely. Seek medical help if large area or on face/hands/feet.
- THIRD-DEGREE burn (black/white, charred, possibly painless): Do NOT apply water. Do NOT apply honey or ointment. Cover with clean cloth. Immediately go to hospital. Do not remove stuck clothing.
- Face burn: ensure breathing.

If the student's steps include "honey" or "burn ointment", only allow them for first-degree burns; for second/third-degree, mark as incorrect.
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