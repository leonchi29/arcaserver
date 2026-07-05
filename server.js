import express from 'express'
import cors from 'cors'

const app = express()
app.use(cors({
  origin: ['http://localhost:5173', 'https://arcanumai-ct.web.app', 'https://arcanumai-ct.firebaseapp.com', 'https://anybody-embezzle-epiphany.ngrok-free.dev'],
  methods: ['GET', 'POST'],
}))
app.use(express.json())

const OLLAMA_HOST = process.env.OLLAMA_HOST || 'http://localhost:11434'

const MODEL_MAP = {
  'arcanum-5.0': process.env.MODEL_5 || 'llama3.1',
  'arcanum-4.0': process.env.MODEL_4 || 'llama3',
  'arcanum-coder': process.env.MODEL_CODER || 'deepseek-coder',
}

function getSystemPrompt(model, userProfile) {
  const modelName = model === 'arcanum-coder' ? 'Arcanum Coder' :
    model === 'arcanum-5.0' ? 'Arcanum 5.0' : 'Arcanum 4.0'

  let prompt = `Eres ${modelName}, un asistente de inteligencia artificial creado por ArcanumAI. 
Tu nombre es ${modelName} y perteneces a la familia de modelos de ArcanumAI.
Si te preguntan quién eres, tu nombre, o qué modelo eres, responde que eres ${modelName} de ArcanumAI.
Nunca menciones que eres otro modelo, ni menciones Llama, DeepSeek, Meta, ni ningún otro nombre de modelo o empresa.
Responde siempre de forma útil, precisa y amable.`

  if (userProfile?.firstName) {
    prompt += `\nEl usuario se llama ${userProfile.firstName} ${userProfile.lastName || ''}.`
    prompt += ` Llámalo por su nombre de forma natural cuando sea apropiado.`
  }

  if (userProfile?.company) {
    prompt += `\nEl usuario trabaja en "${userProfile.company}". Cuando hable de temas de trabajo o empresa, ten en cuenta que se refiere a ${userProfile.company}.`
  }

  if (userProfile?.behavior) {
    prompt += `\n\nInstrucciones adicionales del usuario: ${userProfile.behavior}`
  }

  return prompt
}

app.post('/api/chat', async (req, res) => {
  try {
    const { messages, model, reasoningLevel, userProfile } = req.body

    const ollamaModel = MODEL_MAP[model] || MODEL_MAP['arcanum-5.0']
    const systemPrompt = getSystemPrompt(model, userProfile)

    const ollamaMessages = [
      { role: 'system', content: systemPrompt },
      ...messages,
    ]

    const temperature = reasoningLevel ? Math.max(0.1, 1.0 - (reasoningLevel * 0.15)) : 0.7

    const response = await fetch(`${OLLAMA_HOST}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: ollamaModel,
        messages: ollamaMessages,
        stream: false,
        options: {
          temperature,
          num_predict: 4096,
        },
      }),
    })

    if (!response.ok) {
      const errorText = await response.text()
      console.error('Model error:', response.status, errorText)
      return res.status(503).json({
        message: 'El servicio de IA no está disponible en este momento. Inténtalo de nuevo más tarde.',
      })
    }

    const data = await response.json()

    res.json({
      message: data.message?.content || 'Sin respuesta del modelo.',
      model: model,
      tokensUsed: data.eval_count || 0,
    })
  } catch (error) {
    console.error('Server error:', error.message)
    res.status(503).json({
      message: 'No se pudo conectar con el servicio de IA. Inténtalo de nuevo más tarde.',
    })
  }
})

app.get('/api/health', async (req, res) => {
  try {
    const response = await fetch(`${OLLAMA_HOST}/api/tags`)
    if (response.ok) {
      const data = await response.json()
      const models = data.models?.map((m) => m.name) || []
      res.json({ status: 'ok', availableModels: models })
    } else {
      res.json({ status: 'error', message: 'Servicio no disponible' })
    }
  } catch {
    res.json({ status: 'error', message: 'Servicio no disponible' })
  }
})

app.get('/api/models', async (req, res) => {
  try {
    const response = await fetch(`${OLLAMA_HOST}/api/tags`)
    if (response.ok) {
      const data = await response.json()
      res.json({ models: data.models || [] })
    } else {
      res.json({ models: [] })
    }
  } catch {
    res.json({ models: [] })
  }
})

const PORT = process.env.PORT || 3001
const HOST = process.env.HOST || '0.0.0.0'
app.listen(PORT, HOST, () => {
  console.log(`ArcanumAI Backend running on ${HOST}:${PORT}`)
})
