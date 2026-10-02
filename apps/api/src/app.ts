import {RefundsController} from './refunds';
import {LaboratoriesController,LaboratoryOrdersController} from './laboratories';
import {InventoryController} from './inventory';
import {ReferralsController} from './referrals';
import {WhatsappRemindersController} from './whatsapp-reminders';
import {ReminderPreferencesController} from './reminder-preferences';
import {ProfessionalReportController} from './professional-report';
import {ProfessionalPaymentsController} from './professional-payments';
import {ProfessionalSharesController} from './professional-shares';
import {CashCountsController} from './cash-counts';
import {CashClosuresController} from './cash-closures';
import {PaymentsController} from './payments';
import {BudgetAcceptancesController} from './budget-acceptances';
import 'reflect-metadata';
import 'dotenv/config';
import { Controller, Get, Module, ServiceUnavailableException,HttpException } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import cookieParser from 'cookie-parser';
import helmet from 'helmet';
import type { Request,Response,NextFunction } from 'express';
import { json } from 'express';
import { query } from '../../../packages/database/src/client';
import { Access, Errors } from './core';
import { AuthController } from './auth';
import { OrganizationsController } from './organizations';
import { MailWorker } from './mail-worker';
import { PatientsController } from './patients';
import { CatalogsController } from './catalogs';
import { AppointmentsController } from './appointments';
import { SearchController } from './search';
import { AvailabilityController } from './availability';
import { PhotoAnnotationsController } from './photo-annotations';
import { ConsentEventsController } from './consent-events';
import { ConsentTemplatesController,PatientConsentsController } from './consents';
import { PrescriptionDraftsController } from './prescription-drafts';
import { BudgetsController } from './budgets';
import { TreatmentPlanController } from './treatment-plans';
import { OdontogramController } from './odontogram';
import { ClinicalController } from './clinical';
import { AttachmentsController } from './attachments';
@Controller('health')
class HealthController {
 @Get('live') live(){return {status:'ok'};}
 @Get('ready') async ready(){try{await query('SELECT 1 FROM schema_migrations LIMIT 1');return {status:'ready'};}catch{throw new ServiceUnavailableException('Servicio no disponible.');}}
}
@Module({controllers:[RefundsController,LaboratoriesController,LaboratoryOrdersController,InventoryController,ReferralsController,WhatsappRemindersController,ReminderPreferencesController,ProfessionalReportController,ProfessionalPaymentsController,ProfessionalSharesController,CashCountsController,CashClosuresController,PaymentsController,BudgetAcceptancesController,AuthController,OrganizationsController,PatientsController,CatalogsController,AppointmentsController,AvailabilityController,SearchController,AttachmentsController,PhotoAnnotationsController,ClinicalController,OdontogramController,TreatmentPlanController,BudgetsController,PrescriptionDraftsController,ConsentTemplatesController,PatientConsentsController,ConsentEventsController,HealthController],providers:[Access,MailWorker]})
class AppModule{}
export async function createApp(){
 if(!process.env.DATABASE_URL||!process.env.APP_ORIGIN||!/^[a-f0-9]{64}$/i.test(process.env.MFA_ENCRYPTION_KEY||''))throw new Error('DATABASE_URL, APP_ORIGIN and 32-byte MFA_ENCRYPTION_KEY required');
 if(process.env.NODE_ENV==='production'&&!process.env.APP_ORIGIN.startsWith('https://'))throw new Error('HTTPS APP_ORIGIN required in production');
 if(process.env.NODE_ENV==='production'){
  const [role]=await query("SELECT rolsuper,rolcreatedb,rolcreaterole,rolbypassrls,has_schema_privilege(current_user,'public','CREATE') AS can_create FROM pg_roles WHERE rolname=current_user");
  if(!role||Object.values(role).some(Boolean))throw new Error('Production API requires a restricted database role');
 }
 const app=await NestFactory.create(AppModule,{logger:['error','warn','log']});
 app.use(helmet());app.use(cookieParser());app.useGlobalFilters(new Errors());
 app.use((req:Request,res:Response,next:NextFunction)=>{
  res.setHeader('Cache-Control','no-store');
  if(!['GET','HEAD','OPTIONS'].includes(req.method)&&req.get('origin')!==process.env.APP_ORIGIN){res.status(403).json({message:'Origen de solicitud no permitido.'});return;}
  next();
 });
 // Authenticate before buffering larger upload bodies; other JSON routes keep the default limit.
 const uploadJson=json({limit:'14mb',inflate:false});
 app.use('/api/patients/:patientId/attachments',async(req:Request,res:Response,next:NextFunction)=>{
  if(req.method!=='POST'||req.path!=='/'){next();return;}
  try{const access=app.get(Access),actor=await access.tenant(req,'patients.edit');await access.rate(`attachment-upload:${actor.organizationId}:${actor.id}`,30,3600);}
  catch(error){const status=error instanceof HttpException?error.getStatus():503;res.status(status).json({message:error instanceof HttpException?error.message:'Servicio no disponible.',statusCode:status});return;}
  uploadJson(req,res,(error?:unknown)=>{if(error){const status=(error as {status?:number}).status===413?413:400;res.status(status).json({message:status===413?'Archivo demasiado grande.':'Cuerpo de carga inválido.',statusCode:status});return;}next();});
 });
 const evidenceJson=json({limit:'7mb',inflate:false});
 app.use('/api/patients/:patientId/consents/:consentId/events',async(req:Request,res:Response,next:NextFunction)=>{
  if(req.method!=='POST'||req.path!=='/'){next();return;}
  try{const access=app.get(Access),actor=await access.tenant(req,'patients.view');await access.tenant(req,'clinical_records.view');await access.tenant(req,'clinical_records.edit');await access.rate('consent-evidence:'+actor.organizationId+':'+actor.id,30,3600);}catch(error){const status=error instanceof HttpException?error.getStatus():503;res.status(status).json({message:error instanceof HttpException?error.message:'Servicio no disponible.',statusCode:status});return;}
  evidenceJson(req,res,(error?:unknown)=>{if(error){const status=(error as {status?:number}).status===413?413:400;res.status(status).json({message:status===413?'Evidencia demasiado grande.':'Carga inválida.',statusCode:status});return;}next();});
 });
 if(process.env.NODE_ENV!=='production'){
  const doc=SwaggerModule.createDocument(app,new DocumentBuilder().setTitle('ALIA DENTAL · API').setDescription('Fase 1. Cookie de sesión + X-CSRF-Token para mutaciones; X-Organization-Id para operaciones de organización. Los cuerpos se validan estrictamente con Zod.').setVersion('0.1.0').addCookieAuth('alia_session').addApiKey({type:'apiKey',in:'header',name:'X-Organization-Id'},'organization').build());SwaggerModule.setup('api/docs',app,doc);
 }
 app.enableShutdownHooks();return app;
}




