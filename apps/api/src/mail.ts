import nodemailer from 'nodemailer';
export async function sendLink(email:string,kind:'reset'|'invite',raw:string,messageId?:string) {
 const transport=nodemailer.createTransport({host:process.env.SMTP_HOST,port:Number(process.env.SMTP_PORT||1025),secure:process.env.SMTP_SECURE==='true',requireTLS:process.env.NODE_ENV==='production',auth:process.env.SMTP_USER?{user:process.env.SMTP_USER,pass:process.env.SMTP_PASS}:undefined,connectionTimeout:5000,greetingTimeout:5000,socketTimeout:5000});
 const link=`${process.env.APP_ORIGIN}/?flow=${kind}&token=${encodeURIComponent(raw)}`;
 await transport.sendMail({from:process.env.SMTP_FROM,to:email,messageId:messageId?`<${messageId}@alia.local>`:undefined,disableFileAccess:true,disableUrlAccess:true,subject:kind==='reset'?'Restablece tu contraseña · ALIA DENTAL':'Tu invitación · ALIA DENTAL',text:`${kind==='reset'?'Solicitaste restablecer tu contraseña. El enlace vence en 30 minutos.':'Te invitaron a una organización. El enlace vence en 48 horas.'}\n\n${link}\n\nSi no esperabas este mensaje, puedes ignorarlo.`});
}
