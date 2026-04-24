import { createHmac } from 'node:crypto'
import react from '@vitejs/plugin-react'
import { defineConfig, loadEnv, type Plugin } from 'vite'

function readBody(request: NodeJS.ReadableStream) {
  return new Promise<string>((resolve, reject) => {
    const chunks: Buffer[] = []
    request.on('data', (chunk) => {
      chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk))
    })
    request.on('end', () => {
      resolve(Buffer.concat(chunks).toString('utf8'))
    })
    request.on('error', reject)
  })
}

function mockPaymentCallbackPlugin(backendOrigin: string): Plugin {
  return {
    name: 'mock-payment-callback',
    configureServer(server) {
      server.middlewares.use('/__dev/mock-payment-callback', async (req, res, next) => {
        if (req.method !== 'POST') {
          next()
          return
        }

        try {
          const rawBody = await readBody(req)
          const payload = (rawBody ? JSON.parse(rawBody) : {}) as {
            outTradeNo?: string
            payStatus?: string
          }

          const outTradeNo = String(payload.outTradeNo ?? '').trim()
          const payStatus = payload.payStatus === 'FAIL' ? 'FAIL' : 'PAID'
          if (!outTradeNo) {
            res.statusCode = 400
            res.setHeader('Content-Type', 'application/json; charset=utf-8')
            res.end(JSON.stringify({ code: 'PARAM_INVALID', message: 'outTradeNo 不能为空' }))
            return
          }

          const timestamp = String(Math.floor(Date.now() / 1000))
          const signature = createHmac('sha256', 'mock-wechat-callback-secret')
            .update(`${outTradeNo}:${payStatus}:${timestamp}`)
            .digest('hex')

          const upstream = await fetch(`${backendOrigin}/api/v1/payments/callback/wechat`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'X-Wechat-Timestamp': timestamp,
              'X-Wechat-Signature': signature,
            },
            body: JSON.stringify({
              outTradeNo,
              payStatus,
            }),
          })

          res.statusCode = upstream.status
          upstream.headers.forEach((value, key) => {
            if (key.toLowerCase() === 'transfer-encoding') {
              return
            }
            res.setHeader(key, value)
          })
          res.end(await upstream.text())
        } catch (error) {
          res.statusCode = 500
          res.setHeader('Content-Type', 'application/json; charset=utf-8')
          res.end(
            JSON.stringify({
              code: 'MOCK_PROXY_ERROR',
              message: error instanceof Error ? error.message : '支付回调代理失败',
            }),
          )
        }
      })
    },
  }
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  const backendOrigin = env.VITE_API_ORIGIN || 'http://127.0.0.1:8080'

  return {
    plugins: [react(), mockPaymentCallbackPlugin(backendOrigin)],
    server: {
      proxy: {
        '/api': backendOrigin,
        '/healthz': backendOrigin,
      },
    },
  }
})
