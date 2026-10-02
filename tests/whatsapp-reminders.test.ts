import {expect,it} from 'vitest';
import {whatsappLink,whatsappMessage,whatsappNumber} from '../apps/api/src/whatsapp-reminders';
it('builds only official click-to-chat URLs and preserves editable special characters',()=>{
 const number=whatsappNumber('+52 (999) 123-45.67');expect(number).toBe('+529991234567');
 const text='Hola & gracias + ¿confirmas?\nCita "mañana" #1';const url=new URL(whatsappLink(number,text));expect(url.origin).toBe('https://wa.me');expect(url.pathname).toBe('/529991234567');expect(url.searchParams.get('text')).toBe(text);
 for(const invalid of ['9991234567','+529991234567?text=otra','https://example.com','+00123456789'])expect(()=>whatsappLink(invalid,text)).toThrow();
});
it('formats the appointment in its own timezone with administrative details only',()=>{
 const text=whatsappMessage({first_name:'Ana',clinic:'Alia',branch:'Centro',starts_at:'2030-01-16T01:00:00Z',timezone:'America/Mexico_City'});
 expect(text).toContain('Ana');expect(text).toContain('Alia, sucursal Centro');expect(text).toContain('15 de enero');expect(text).toContain('7:00 p.m.');expect(text).toContain('respondiendo a este mensaje');expect(text).not.toContain('confirmada');
});
