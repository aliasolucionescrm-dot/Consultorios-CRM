import { createApp } from './app';
createApp().then(app=>app.listen(Number(process.env.API_PORT||4000),process.env.NODE_ENV==='production'?'0.0.0.0':'127.0.0.1')).catch(()=>{console.error('API startup failed. Check environment and database.');process.exitCode=1;});
