export interface Me {user:{id:string;name:string;email:string};organizations:{id:string;name:string;role:string;timezone:string;currency:string}[];csrf:string;mfaEnabled:boolean}
export interface Organization {id:string;name:string;legal_name:string;rfc:string;phone:string;email:string;address:string;timezone:string;currency:string;locale:string;record_prefix:string;created_at:string}
export interface Branch {id:string;name:string;address:string;phone:string;active:boolean}
export interface Context {organization:Organization;branches:Branch[];permissions:string[];counts:{members:number;roles:number}}
export interface Role {id:string;name:string;system:boolean;permissions:string[]}
export interface Member {id:string;name:string;email:string;active:boolean;role_id:string;role:string}
