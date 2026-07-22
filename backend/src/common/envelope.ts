export const ok  = (data:any) => ({ response_status:{ error:'' }, response_data:data });
export const err = (m:string, code=1) => ({ response_status:{ error:m, code }, response_data:false });
export interface ActionReq { action:string; token?:string; uid?:string|number; _login_uid?:number; lang?:string; ua?:string; deviceid?:string; sign?:string; timestamp?:number; [k:string]:any; }
