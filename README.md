telegram bot with cloudflare worker ai generate images with ai model 


1. login: https://dash.cloudflare.com/. compute(workers)-worker & pages - create- hello world- deploy - edit code
   
3. upload or paste worker.js file in worker page and click on deploy

5. add Variables and Secrets text: name: TELEGRAM_BOT_TOKEN, bot-token from @botfather
   
4- go to binding page and bind worker ai : AI
   
5- set webhook: https://api.telegram.org/botBOT_TOKEN/setWebhook?url=https://WORKER_ADDRESS.workers.dev


