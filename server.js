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
- If the method is "honey", "pure honey", "medical honey", "aloe vera", "pure aloe vera":
  Set "correct": true.
  Reason: "Honey or aloe vera may be used on very minor first-degree burns with unbroken skin for soothing effect. They are not standard first aid. Do not use on broken skin, blisters, or severe burns. Standard treatment: cool water, dry, cover."
- If the method is "cool water", "cool running water", "cool tap water":
  Set "correct": true. Reason: "Cool running water for 10-20 minutes is the correct first step for minor burns."
- If the method is dangerous (e.g., "butter", "oil", "coconut oil", "ice directly", "toothpaste", "soy sauce", "pop blisters"):
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

   const prompt = `You are a first aid educator for high school students. Evaluate the student's sequence of steps for a burn patient.

Patient degree: ${degreeText}.
Student's steps (in order): ${steps.join(' → ')}.

Strict rules for correctness:

1. FIRST-DEGREE burn (first):
   - Allowed steps: cool water, dry gently, remove clothes if not stuck, cover with clean cloth.
   - Allowed additional steps (before cover): burn ointment, honey, aloe vera (but not oil, butter, toothpaste, ice).
   - Forbidden: any oil, butter, toothpaste, ice, popping blisters.
   - Hospital step is NOT required.
   - The face-breathing step ("😮‍💨 Face burn...") is optional and can appear anywhere without penalty.
   - If the student includes ONLY correct steps (no forbidden items) and at least one core step (e.g., cool water or cover), it is SUCCESS.

2. SECOND-DEGREE burn (second):
   - Allowed steps: cool water, dry gently, remove clothes, cover with clean cloth.
   - MUST include the hospital step ("🚑 2nd/3rd degree: take to hospital immediately"). It can be anywhere.
   - Forbidden: any ointment, honey, aloe vera, oil, butter, toothpaste, ice.
   - The face-breathing step is optional and can appear anywhere.
   - If the student includes the hospital step and no forbidden items, it is SUCCESS (even if they skip some non-core steps like remove clothes). But they should not have dangerous items.

3. THIRD-DEGREE burn (third):
   - Allowed steps: cover with clean cloth, hospital step.
   - It is SUCCESS if the student includes ONLY the hospital step (even alone) OR cover + hospital.
   - Forbidden: cool water, dry gently, remove clothes, any ointment/honey/aloe, oil, butter, toothpaste, ice.
   - The face-breathing step is optional and allowed anywhere.
   - If the student includes any forbidden step (especially water), it is FAILURE.

4. For ALL degrees:
   - If the sequence contains any dangerous method (oil, butter, toothpaste, ice directly, pop blisters), it is FAILURE.
   - The face-breathing step never causes failure regardless of position.

Respond in JSON: {"success": true/false, "feedback": "short explanation (1 sentence for high school students)"}.`;
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