import type { Metadata } from 'next';
import './globals.css';
export const metadata:Metadata={title:'ALIA DENTAL · Alia Soluciones',description:'Tu espacio de gestión odontológica.'};
export default function Layout({children}:{children:React.ReactNode}) {return <html lang="es-MX"><body>{children}</body></html>;}
