(()=>{var Oe=()=>{};var xe=function(e){let t=[],n=0;for(let r=0;r<e.length;r++){let i=e.charCodeAt(r);i<128?t[n++]=i:i<2048?(t[n++]=i>>6|192,t[n++]=i&63|128):(i&64512)===55296&&r+1<e.length&&(e.charCodeAt(r+1)&64512)===56320?(i=65536+((i&1023)<<10)+(e.charCodeAt(++r)&1023),t[n++]=i>>18|240,t[n++]=i>>12&63|128,t[n++]=i>>6&63|128,t[n++]=i&63|128):(t[n++]=i>>12|224,t[n++]=i>>6&63|128,t[n++]=i&63|128)}return t},vt=function(e){let t=[],n=0,r=0;for(;n<e.length;){let i=e[n++];if(i<128)t[r++]=String.fromCharCode(i);else if(i>191&&i<224){let o=e[n++];t[r++]=String.fromCharCode((i&31)<<6|o&63)}else if(i>239&&i<365){let o=e[n++],s=e[n++],c=e[n++],u=((i&7)<<18|(o&63)<<12|(s&63)<<6|c&63)-65536;t[r++]=String.fromCharCode(55296+(u>>10)),t[r++]=String.fromCharCode(56320+(u&1023))}else{let o=e[n++],s=e[n++];t[r++]=String.fromCharCode((i&15)<<12|(o&63)<<6|s&63)}}return t.join("")},Me={byteToCharMap_:null,charToByteMap_:null,byteToCharMapWebSafe_:null,charToByteMapWebSafe_:null,ENCODED_VALS_BASE:"ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789",get ENCODED_VALS(){return this.ENCODED_VALS_BASE+"+/="},get ENCODED_VALS_WEBSAFE(){return this.ENCODED_VALS_BASE+"-_."},HAS_NATIVE_SUPPORT:typeof atob=="function",encodeByteArray(e,t){if(!Array.isArray(e))throw Error("encodeByteArray takes an array as a parameter");this.init_();let n=t?this.byteToCharMapWebSafe_:this.byteToCharMap_,r=[];for(let i=0;i<e.length;i+=3){let o=e[i],s=i+1<e.length,c=s?e[i+1]:0,u=i+2<e.length,a=u?e[i+2]:0,O=o>>2,C=(o&3)<<4|c>>4,N=(c&15)<<2|a>>6,x=a&63;u||(x=64,s||(N=64)),r.push(n[O],n[C],n[N],n[x])}return r.join("")},encodeString(e,t){return this.HAS_NATIVE_SUPPORT&&!t?btoa(e):this.encodeByteArray(xe(e),t)},decodeString(e,t){return this.HAS_NATIVE_SUPPORT&&!t?atob(e):vt(this.decodeStringToByteArray(e,t))},decodeStringToByteArray(e,t){this.init_();let n=t?this.charToByteMapWebSafe_:this.charToByteMap_,r=[];for(let i=0;i<e.length;){let o=n[e.charAt(i++)],c=i<e.length?n[e.charAt(i)]:0;++i;let a=i<e.length?n[e.charAt(i)]:64;++i;let C=i<e.length?n[e.charAt(i)]:64;if(++i,o==null||c==null||a==null||C==null)throw new q;let N=o<<2|c>>4;if(r.push(N),a!==64){let x=c<<4&240|a>>2;if(r.push(x),C!==64){let At=a<<6&192|C;r.push(At)}}}return r},init_(){if(!this.byteToCharMap_){this.byteToCharMap_={},this.charToByteMap_={},this.byteToCharMapWebSafe_={},this.charToByteMapWebSafe_={};for(let e=0;e<this.ENCODED_VALS.length;e++)this.byteToCharMap_[e]=this.ENCODED_VALS.charAt(e),this.charToByteMap_[this.byteToCharMap_[e]]=e,this.byteToCharMapWebSafe_[e]=this.ENCODED_VALS_WEBSAFE.charAt(e),this.charToByteMapWebSafe_[this.byteToCharMapWebSafe_[e]]=e,e>=this.ENCODED_VALS_BASE.length&&(this.charToByteMap_[this.ENCODED_VALS_WEBSAFE.charAt(e)]=e,this.charToByteMapWebSafe_[this.ENCODED_VALS.charAt(e)]=e)}}},q=class extends Error{constructor(){super(...arguments),this.name="DecodeBase64StringError"}},Dt=function(e){let t=xe(e);return Me.encodeByteArray(t,!0)},G=function(e){return Dt(e).replace(/\./g,"")},Be=function(e){try{return Me.decodeString(e,!0)}catch(t){console.error("base64Decode failed: ",t)}return null};function Ct(){if(typeof self<"u")return self;if(typeof window<"u")return window;if(typeof global<"u")return global;throw new Error("Unable to locate global object.")}var Tt=()=>Ct().__FIREBASE_DEFAULTS__,kt=()=>{if(typeof process>"u"||typeof process.env>"u")return;let e=process.env.__FIREBASE_DEFAULTS__;if(e)return JSON.parse(e)},Ot=()=>{if(typeof document>"u")return;let e;try{e=document.cookie.match(/__FIREBASE_DEFAULTS__=([^;]+)/)}catch{return}let t=e&&Be(e[1]);return t&&JSON.parse(t)},Nt=()=>{try{return Oe()||Tt()||kt()||Ot()}catch(e){console.info(`Unable to get __FIREBASE_DEFAULTS__ due to: ${e}`);return}};var J=()=>Nt()?.config;var M=class{constructor(){this.reject=()=>{},this.resolve=()=>{},this.promise=new Promise((t,n)=>{this.resolve=t,this.reject=n})}wrapCallback(t){return(n,r)=>{n?this.reject(n):this.resolve(r),typeof t=="function"&&(this.promise.catch(()=>{}),t.length===1?t(n):t(n,r))}}};function B(){try{return typeof indexedDB=="object"}catch{return!1}}function R(){return new Promise((e,t)=>{try{let n=!0,r="validate-browser-context-for-indexeddb-analytics-module",i=self.indexedDB.open(r);i.onsuccess=()=>{i.result.close(),n||self.indexedDB.deleteDatabase(r),e(!0)},i.onupgradeneeded=()=>{n=!1},i.onerror=()=>{t(i.error?.message||"")}}catch(n){t(n)}})}var xt="FirebaseError",p=class e extends Error{constructor(t,n,r){super(n),this.code=t,this.customData=r,this.name=xt,Object.setPrototypeOf(this,e.prototype),Error.captureStackTrace&&Error.captureStackTrace(this,g.prototype.create)}},g=class{constructor(t,n,r){this.service=t,this.serviceName=n,this.errors=r}create(t,...n){let r=n[0]||{},i=`${this.service}/${t}`,o=this.errors[t],s=o?Mt(o,r):"Error",c=`${this.serviceName}: ${s} (${i}).`;return new p(i,c,r)}};function Mt(e,t){return e.replace(Bt,(n,r)=>{let i=t[r];return i!=null?String(i):`<${r}?>`})}var Bt=/\{\$([^}]+)}/g;function L(e,t){if(e===t)return!0;let n=Object.keys(e),r=Object.keys(t);for(let i of n){if(!r.includes(i))return!1;let o=e[i],s=t[i];if(Ne(o)&&Ne(s)){if(!L(o,s))return!1}else if(o!==s)return!1}for(let i of r)if(!n.includes(i))return!1;return!0}function Ne(e){return e!==null&&typeof e=="object"}var wi=14400*1e3;function Y(e){return e&&e._delegate?e._delegate:e}var l=class{constructor(t,n,r){this.name=t,this.instanceFactory=n,this.type=r,this.multipleInstances=!1,this.serviceProps={},this.instantiationMode="LAZY",this.onInstanceCreated=null}setInstantiationMode(t){return this.instantiationMode=t,this}setMultipleInstances(t){return this.multipleInstances=t,this}setServiceProps(t){return this.serviceProps=t,this}setInstanceCreatedCallback(t){return this.onInstanceCreated=t,this}};var E="[DEFAULT]";var Q=class{constructor(t,n){this.name=t,this.container=n,this.component=null,this.instances=new Map,this.instancesDeferred=new Map,this.instancesOptions=new Map,this.onInitCallbacks=new Map}get(t){let n=this.normalizeInstanceIdentifier(t);if(!this.instancesDeferred.has(n)){let r=new M;if(this.instancesDeferred.set(n,r),this.isInitialized(n)||this.shouldAutoInitialize())try{let i=this.getOrInitializeService({instanceIdentifier:n});i&&r.resolve(i)}catch{}}return this.instancesDeferred.get(n).promise}getImmediate(t){let n=this.normalizeInstanceIdentifier(t?.identifier),r=t?.optional??!1;if(this.isInitialized(n)||this.shouldAutoInitialize())try{return this.getOrInitializeService({instanceIdentifier:n})}catch(i){if(r)return null;throw i}else{if(r)return null;throw Error(`Service ${this.name} is not available`)}}getComponent(){return this.component}setComponent(t){if(t.name!==this.name)throw Error(`Mismatching Component ${t.name} for Provider ${this.name}.`);if(this.component)throw Error(`Component for ${this.name} has already been provided`);if(this.component=t,!!this.shouldAutoInitialize()){if(Lt(t))try{this.getOrInitializeService({instanceIdentifier:E})}catch{}for(let[n,r]of this.instancesDeferred.entries()){let i=this.normalizeInstanceIdentifier(n);try{let o=this.getOrInitializeService({instanceIdentifier:i});r.resolve(o)}catch{}}}}clearInstance(t=E){this.instancesDeferred.delete(t),this.instancesOptions.delete(t),this.instances.delete(t)}async delete(){let t=Array.from(this.instances.values());await Promise.all([...t.filter(n=>"INTERNAL"in n).map(n=>n.INTERNAL.delete()),...t.filter(n=>"_delete"in n).map(n=>n._delete())])}isComponentSet(){return this.component!=null}isInitialized(t=E){return this.instances.has(t)}getOptions(t=E){return this.instancesOptions.get(t)||{}}initialize(t={}){let{options:n={}}=t,r=this.normalizeInstanceIdentifier(t.instanceIdentifier);if(this.isInitialized(r))throw Error(`${this.name}(${r}) has already been initialized`);if(!this.isComponentSet())throw Error(`Component ${this.name} has not been registered yet`);let i=this.getOrInitializeService({instanceIdentifier:r,options:n});for(let[o,s]of this.instancesDeferred.entries()){let c=this.normalizeInstanceIdentifier(o);r===c&&s.resolve(i)}return i}onInit(t,n){let r=this.normalizeInstanceIdentifier(n),i=this.onInitCallbacks.get(r)??new Set;i.add(t),this.onInitCallbacks.set(r,i);let o=this.instances.get(r);return o&&t(o,r),()=>{i.delete(t)}}invokeOnInitCallbacks(t,n){let r=this.onInitCallbacks.get(n);if(r)for(let i of r)try{i(t,n)}catch{}}getOrInitializeService({instanceIdentifier:t,options:n={}}){let r=this.instances.get(t);if(!r&&this.component&&(r=this.component.instanceFactory(this.container,{instanceIdentifier:Rt(t),options:n}),this.instances.set(t,r),this.instancesOptions.set(t,n),this.invokeOnInitCallbacks(r,t),this.component.onInstanceCreated))try{this.component.onInstanceCreated(this.container,t,r)}catch{}return r||null}normalizeInstanceIdentifier(t=E){return this.component?this.component.multipleInstances?t:E:t}shouldAutoInitialize(){return!!this.component&&this.component.instantiationMode!=="EXPLICIT"}};function Rt(e){return e===E?void 0:e}function Lt(e){return e.instantiationMode==="EAGER"}var P=class{constructor(t){this.name=t,this.providers=new Map}addComponent(t){let n=this.getProvider(t.name);if(n.isComponentSet())throw new Error(`Component ${t.name} has already been registered with ${this.name}`);n.setComponent(t)}addOrOverwriteComponent(t){this.getProvider(t.name).isComponentSet()&&this.providers.delete(t.name),this.addComponent(t)}getProvider(t){if(this.providers.has(t))return this.providers.get(t);let n=new Q(t,this);return this.providers.set(t,n),n}getProviders(){return Array.from(this.providers.values())}};var Pt=[],f;(function(e){e[e.DEBUG=0]="DEBUG",e[e.VERBOSE=1]="VERBOSE",e[e.INFO=2]="INFO",e[e.WARN=3]="WARN",e[e.ERROR=4]="ERROR",e[e.SILENT=5]="SILENT"})(f||(f={}));var Ft={debug:f.DEBUG,verbose:f.VERBOSE,info:f.INFO,warn:f.WARN,error:f.ERROR,silent:f.SILENT},$t=f.INFO,jt={[f.DEBUG]:"log",[f.VERBOSE]:"log",[f.INFO]:"info",[f.WARN]:"warn",[f.ERROR]:"error"},Ht=(e,t,...n)=>{if(t<e.logLevel)return;let r=new Date().toISOString(),i=jt[t];if(i)console[i](`[${r}]  ${e.name}:`,...n);else throw new Error(`Attempted to log a message with an invalid logType (value: ${t})`)},F=class{constructor(t){this.name=t,this._logLevel=$t,this._logHandler=Ht,this._userLogHandler=null,Pt.push(this)}get logLevel(){return this._logLevel}set logLevel(t){if(!(t in f))throw new TypeError(`Invalid value "${t}" assigned to \`logLevel\``);this._logLevel=t}setLogLevel(t){this._logLevel=typeof t=="string"?Ft[t]:t}get logHandler(){return this._logHandler}set logHandler(t){if(typeof t!="function")throw new TypeError("Value assigned to `logHandler` must be a function");this._logHandler=t}get userLogHandler(){return this._userLogHandler}set userLogHandler(t){this._userLogHandler=t}debug(...t){this._userLogHandler&&this._userLogHandler(this,f.DEBUG,...t),this._logHandler(this,f.DEBUG,...t)}log(...t){this._userLogHandler&&this._userLogHandler(this,f.VERBOSE,...t),this._logHandler(this,f.VERBOSE,...t)}info(...t){this._userLogHandler&&this._userLogHandler(this,f.INFO,...t),this._logHandler(this,f.INFO,...t)}warn(...t){this._userLogHandler&&this._userLogHandler(this,f.WARN,...t),this._logHandler(this,f.WARN,...t)}error(...t){this._userLogHandler&&this._userLogHandler(this,f.ERROR,...t),this._logHandler(this,f.ERROR,...t)}};var Ut=(e,t)=>t.some(n=>e instanceof n),Re,Le;function Vt(){return Re||(Re=[IDBDatabase,IDBObjectStore,IDBIndex,IDBCursor,IDBTransaction])}function zt(){return Le||(Le=[IDBCursor.prototype.advance,IDBCursor.prototype.continue,IDBCursor.prototype.continuePrimaryKey])}var Pe=new WeakMap,Z=new WeakMap,Fe=new WeakMap,X=new WeakMap,te=new WeakMap;function Wt(e){let t=new Promise((n,r)=>{let i=()=>{e.removeEventListener("success",o),e.removeEventListener("error",s)},o=()=>{n(h(e.result)),i()},s=()=>{r(e.error),i()};e.addEventListener("success",o),e.addEventListener("error",s)});return t.then(n=>{n instanceof IDBCursor&&Pe.set(n,e)}).catch(()=>{}),te.set(t,e),t}function Kt(e){if(Z.has(e))return;let t=new Promise((n,r)=>{let i=()=>{e.removeEventListener("complete",o),e.removeEventListener("error",s),e.removeEventListener("abort",s)},o=()=>{n(),i()},s=()=>{r(e.error||new DOMException("AbortError","AbortError")),i()};e.addEventListener("complete",o),e.addEventListener("error",s),e.addEventListener("abort",s)});Z.set(e,t)}var ee={get(e,t,n){if(e instanceof IDBTransaction){if(t==="done")return Z.get(e);if(t==="objectStoreNames")return e.objectStoreNames||Fe.get(e);if(t==="store")return n.objectStoreNames[1]?void 0:n.objectStore(n.objectStoreNames[0])}return h(e[t])},set(e,t,n){return e[t]=n,!0},has(e,t){return e instanceof IDBTransaction&&(t==="done"||t==="store")?!0:t in e}};function $e(e){ee=e(ee)}function qt(e){return e===IDBDatabase.prototype.transaction&&!("objectStoreNames"in IDBTransaction.prototype)?function(t,...n){let r=e.call($(this),t,...n);return Fe.set(r,t.sort?t.sort():[t]),h(r)}:zt().includes(e)?function(...t){return e.apply($(this),t),h(Pe.get(this))}:function(...t){return h(e.apply($(this),t))}}function Gt(e){return typeof e=="function"?qt(e):(e instanceof IDBTransaction&&Kt(e),Ut(e,Vt())?new Proxy(e,ee):e)}function h(e){if(e instanceof IDBRequest)return Wt(e);if(X.has(e))return X.get(e);let t=Gt(e);return t!==e&&(X.set(e,t),te.set(t,e)),t}var $=e=>te.get(e);function S(e,t,{blocked:n,upgrade:r,blocking:i,terminated:o}={}){let s=indexedDB.open(e,t),c=h(s);return r&&s.addEventListener("upgradeneeded",u=>{r(h(s.result),u.oldVersion,u.newVersion,h(s.transaction),u)}),n&&s.addEventListener("blocked",u=>n(u.oldVersion,u.newVersion,u)),c.then(u=>{o&&u.addEventListener("close",()=>o()),i&&u.addEventListener("versionchange",a=>i(a.oldVersion,a.newVersion,a))}).catch(()=>{}),c}function j(e,{blocked:t}={}){let n=indexedDB.deleteDatabase(e);return t&&n.addEventListener("blocked",r=>t(r.oldVersion,r)),h(n).then(()=>{})}var Jt=["get","getKey","getAll","getAllKeys","count"],Yt=["put","add","delete","clear"],ne=new Map;function je(e,t){if(!(e instanceof IDBDatabase&&!(t in e)&&typeof t=="string"))return;if(ne.get(t))return ne.get(t);let n=t.replace(/FromIndex$/,""),r=t!==n,i=Yt.includes(n);if(!(n in(r?IDBIndex:IDBObjectStore).prototype)||!(i||Jt.includes(n)))return;let o=async function(s,...c){let u=this.transaction(s,i?"readwrite":"readonly"),a=u.store;return r&&(a=a.index(c.shift())),(await Promise.all([a[n](...c),i&&u.done]))[0]};return ne.set(t,o),o}$e(e=>({...e,get:(t,n,r)=>je(t,n)||e.get(t,n,r),has:(t,n)=>!!je(t,n)||e.has(t,n)}));var ie=class{constructor(t){this.container=t}getPlatformInfoString(){return this.container.getProviders().map(n=>{if(Qt(n)){let r=n.getImmediate();return`${r.library}/${r.version}`}else return null}).filter(n=>n).join(" ")}};function Qt(e){return e.getComponent()?.type==="VERSION"}var oe="@firebase/app",He="0.14.11";var m=new F("@firebase/app"),Xt="@firebase/app-compat",Zt="@firebase/analytics-compat",en="@firebase/analytics",tn="@firebase/app-check-compat",nn="@firebase/app-check",rn="@firebase/auth",on="@firebase/auth-compat",sn="@firebase/database",an="@firebase/data-connect",cn="@firebase/database-compat",un="@firebase/functions",fn="@firebase/functions-compat",ln="@firebase/installations",dn="@firebase/installations-compat",hn="@firebase/messaging",pn="@firebase/messaging-compat",gn="@firebase/performance",mn="@firebase/performance-compat",bn="@firebase/remote-config",wn="@firebase/remote-config-compat",yn="@firebase/storage",_n="@firebase/storage-compat",En="@firebase/firestore",Sn="@firebase/ai",In="@firebase/firestore-compat",An="firebase";var se="[DEFAULT]",vn={[oe]:"fire-core",[Xt]:"fire-core-compat",[en]:"fire-analytics",[Zt]:"fire-analytics-compat",[nn]:"fire-app-check",[tn]:"fire-app-check-compat",[rn]:"fire-auth",[on]:"fire-auth-compat",[sn]:"fire-rtdb",[an]:"fire-data-connect",[cn]:"fire-rtdb-compat",[un]:"fire-fn",[fn]:"fire-fn-compat",[ln]:"fire-iid",[dn]:"fire-iid-compat",[hn]:"fire-fcm",[pn]:"fire-fcm-compat",[gn]:"fire-perf",[mn]:"fire-perf-compat",[bn]:"fire-rc",[wn]:"fire-rc-compat",[yn]:"fire-gcs",[_n]:"fire-gcs-compat",[En]:"fire-fst",[In]:"fire-fst-compat",[Sn]:"fire-vertex","fire-js":"fire-js",[An]:"fire-js-all"};var H=new Map,Dn=new Map,ae=new Map;function Ue(e,t){try{e.container.addComponent(t)}catch(n){m.debug(`Component ${t.name} failed to register with FirebaseApp ${e.name}`,n)}}function _(e){let t=e.name;if(ae.has(t))return m.debug(`There were multiple attempts to register component ${t}.`),!1;ae.set(t,e);for(let n of H.values())Ue(n,e);for(let n of Dn.values())Ue(n,e);return!0}function k(e,t){let n=e.container.getProvider("heartbeat").getImmediate({optional:!0});return n&&n.triggerHeartbeat(),e.container.getProvider(t)}var Cn={"no-app":"No Firebase App '{$appName}' has been created - call initializeApp() first","bad-app-name":"Illegal App name: '{$appName}'","duplicate-app":"Firebase App named '{$appName}' already exists with different options or config","app-deleted":"Firebase App named '{$appName}' already deleted","server-app-deleted":"Firebase Server App has been deleted","no-options":"Need to provide options, when not being deployed to hosting via source.","invalid-app-argument":"firebase.{$appName}() takes either no argument or a Firebase App instance.","invalid-log-argument":"First argument to `onLog` must be null or a function.","idb-open":"Error thrown when opening IndexedDB. Original error: {$originalErrorMessage}.","idb-get":"Error thrown when reading from IndexedDB. Original error: {$originalErrorMessage}.","idb-set":"Error thrown when writing to IndexedDB. Original error: {$originalErrorMessage}.","idb-delete":"Error thrown when deleting from IndexedDB. Original error: {$originalErrorMessage}.","finalization-registry-not-supported":"FirebaseServerApp deleteOnDeref field defined but the JS runtime does not support FinalizationRegistry.","invalid-server-app-environment":"FirebaseServerApp is not for use in browser environments."},w=new g("app","Firebase",Cn);var ce=class{constructor(t,n,r){this._isDeleted=!1,this._options={...t},this._config={...n},this._name=n.name,this._automaticDataCollectionEnabled=n.automaticDataCollectionEnabled,this._container=r,this.container.addComponent(new l("app",()=>this,"PUBLIC"))}get automaticDataCollectionEnabled(){return this.checkDestroyed(),this._automaticDataCollectionEnabled}set automaticDataCollectionEnabled(t){this.checkDestroyed(),this._automaticDataCollectionEnabled=t}get name(){return this.checkDestroyed(),this._name}get options(){return this.checkDestroyed(),this._options}get config(){return this.checkDestroyed(),this._config}get container(){return this._container}get isDeleted(){return this._isDeleted}set isDeleted(t){this._isDeleted=t}checkDestroyed(){if(this.isDeleted)throw w.create("app-deleted",{appName:this._name})}};function le(e,t={}){let n=e;typeof t!="object"&&(t={name:t});let r={name:se,automaticDataCollectionEnabled:!0,...t},i=r.name;if(typeof i!="string"||!i)throw w.create("bad-app-name",{appName:String(i)});if(n||(n=J()),!n)throw w.create("no-options");let o=H.get(i);if(o){if(L(n,o.options)&&L(r,o.config))return o;throw w.create("duplicate-app",{appName:i})}let s=new P(i);for(let u of ae.values())s.addComponent(u);let c=new ce(n,r,s);return H.set(i,c),c}function de(e=se){let t=H.get(e);if(!t&&e===se&&J())return le();if(!t)throw w.create("no-app",{appName:e});return t}function y(e,t,n){let r=vn[e]??e;n&&(r+=`-${n}`);let i=r.match(/\s|\//),o=t.match(/\s|\//);if(i||o){let s=[`Unable to register library "${r}" with version "${t}":`];i&&s.push(`library name "${r}" contains illegal characters (whitespace or "/")`),i&&o&&s.push("and"),o&&s.push(`version name "${t}" contains illegal characters (whitespace or "/")`),m.warn(s.join(" "));return}_(new l(`${r}-version`,()=>({library:r,version:t}),"VERSION"))}var Tn="firebase-heartbeat-database",kn=1,T="firebase-heartbeat-store",re=null;function Ke(){return re||(re=S(Tn,kn,{upgrade:(e,t)=>{switch(t){case 0:try{e.createObjectStore(T)}catch(n){console.warn(n)}}}}).catch(e=>{throw w.create("idb-open",{originalErrorMessage:e.message})})),re}async function On(e){try{let n=(await Ke()).transaction(T),r=await n.objectStore(T).get(qe(e));return await n.done,r}catch(t){if(t instanceof p)m.warn(t.message);else{let n=w.create("idb-get",{originalErrorMessage:t?.message});m.warn(n.message)}}}async function Ve(e,t){try{let r=(await Ke()).transaction(T,"readwrite");await r.objectStore(T).put(t,qe(e)),await r.done}catch(n){if(n instanceof p)m.warn(n.message);else{let r=w.create("idb-set",{originalErrorMessage:n?.message});m.warn(r.message)}}}function qe(e){return`${e.name}!${e.options.appId}`}var Nn=1024,xn=30,ue=class{constructor(t){this.container=t,this._heartbeatsCache=null;let n=this.container.getProvider("app").getImmediate();this._storage=new fe(n),this._heartbeatsCachePromise=this._storage.read().then(r=>(this._heartbeatsCache=r,r))}async triggerHeartbeat(){try{let n=this.container.getProvider("platform-logger").getImmediate().getPlatformInfoString(),r=ze();if(this._heartbeatsCache?.heartbeats==null&&(this._heartbeatsCache=await this._heartbeatsCachePromise,this._heartbeatsCache?.heartbeats==null)||this._heartbeatsCache.lastSentHeartbeatDate===r||this._heartbeatsCache.heartbeats.some(i=>i.date===r))return;if(this._heartbeatsCache.heartbeats.push({date:r,agent:n}),this._heartbeatsCache.heartbeats.length>xn){let i=Bn(this._heartbeatsCache.heartbeats);this._heartbeatsCache.heartbeats.splice(i,1)}return this._storage.overwrite(this._heartbeatsCache)}catch(t){m.warn(t)}}async getHeartbeatsHeader(){try{if(this._heartbeatsCache===null&&await this._heartbeatsCachePromise,this._heartbeatsCache?.heartbeats==null||this._heartbeatsCache.heartbeats.length===0)return"";let t=ze(),{heartbeatsToSend:n,unsentEntries:r}=Mn(this._heartbeatsCache.heartbeats),i=G(JSON.stringify({version:2,heartbeats:n}));return this._heartbeatsCache.lastSentHeartbeatDate=t,r.length>0?(this._heartbeatsCache.heartbeats=r,await this._storage.overwrite(this._heartbeatsCache)):(this._heartbeatsCache.heartbeats=[],this._storage.overwrite(this._heartbeatsCache)),i}catch(t){return m.warn(t),""}}};function ze(){return new Date().toISOString().substring(0,10)}function Mn(e,t=Nn){let n=[],r=e.slice();for(let i of e){let o=n.find(s=>s.agent===i.agent);if(o){if(o.dates.push(i.date),We(n)>t){o.dates.pop();break}}else if(n.push({agent:i.agent,dates:[i.date]}),We(n)>t){n.pop();break}r=r.slice(1)}return{heartbeatsToSend:n,unsentEntries:r}}var fe=class{constructor(t){this.app=t,this._canUseIndexedDBPromise=this.runIndexedDBEnvironmentCheck()}async runIndexedDBEnvironmentCheck(){return B()?R().then(()=>!0).catch(()=>!1):!1}async read(){if(await this._canUseIndexedDBPromise){let n=await On(this.app);return n?.heartbeats?n:{heartbeats:[]}}else return{heartbeats:[]}}async overwrite(t){if(await this._canUseIndexedDBPromise){let r=await this.read();return Ve(this.app,{lastSentHeartbeatDate:t.lastSentHeartbeatDate??r.lastSentHeartbeatDate,heartbeats:t.heartbeats})}else return}async add(t){if(await this._canUseIndexedDBPromise){let r=await this.read();return Ve(this.app,{lastSentHeartbeatDate:t.lastSentHeartbeatDate??r.lastSentHeartbeatDate,heartbeats:[...r.heartbeats,...t.heartbeats]})}else return}};function We(e){return G(JSON.stringify({version:2,heartbeats:e})).length}function Bn(e){if(e.length===0)return-1;let t=0,n=e[0].date;for(let r=1;r<e.length;r++)e[r].date<n&&(n=e[r].date,t=r);return t}function Rn(e){_(new l("platform-logger",t=>new ie(t),"PRIVATE")),_(new l("heartbeat",t=>new ue(t),"PRIVATE")),y(oe,He,e),y(oe,He,"esm2020"),y("fire-js","")}Rn("");var Ln="firebase",Pn="12.12.0";y(Ln,Pn,"app");var Ye="@firebase/installations",me="0.6.21";var Qe=1e4,Xe=`w:${me}`,Ze="FIS_v2",Fn="https://firebaseinstallations.googleapis.com/v1",$n=3600*1e3,jn="installations",Hn="Installations";var Un={"missing-app-config-values":'Missing App configuration value: "{$valueName}"',"not-registered":"Firebase Installation is not registered.","installation-not-found":"Firebase Installation not found.","request-failed":'{$requestName} request failed with error "{$serverCode} {$serverStatus}: {$serverMessage}"',"app-offline":"Could not process request. Application offline.","delete-pending-registration":"Can't delete installation while there is a pending registration request."},A=new g(jn,Hn,Un);function et(e){return e instanceof p&&e.code.includes("request-failed")}function tt({projectId:e}){return`${Fn}/projects/${e}/installations`}function nt(e){return{token:e.token,requestStatus:2,expiresIn:zn(e.expiresIn),creationTime:Date.now()}}async function rt(e,t){let r=(await t.json()).error;return A.create("request-failed",{requestName:e,serverCode:r.code,serverMessage:r.message,serverStatus:r.status})}function it({apiKey:e}){return new Headers({"Content-Type":"application/json",Accept:"application/json","x-goog-api-key":e})}function Vn(e,{refreshToken:t}){let n=it(e);return n.append("Authorization",Wn(t)),n}async function ot(e){let t=await e();return t.status>=500&&t.status<600?e():t}function zn(e){return Number(e.replace("s","000"))}function Wn(e){return`${Ze} ${e}`}async function Kn({appConfig:e,heartbeatServiceProvider:t},{fid:n}){let r=tt(e),i=it(e),o=t.getImmediate({optional:!0});if(o){let a=await o.getHeartbeatsHeader();a&&i.append("x-firebase-client",a)}let s={fid:n,authVersion:Ze,appId:e.appId,sdkVersion:Xe},c={method:"POST",headers:i,body:JSON.stringify(s)},u=await ot(()=>fetch(r,c));if(u.ok){let a=await u.json();return{fid:a.fid||n,registrationStatus:2,refreshToken:a.refreshToken,authToken:nt(a.authToken)}}else throw await rt("Create Installation",u)}function st(e){return new Promise(t=>{setTimeout(t,e)})}function qn(e){return btoa(String.fromCharCode(...e)).replace(/\+/g,"-").replace(/\//g,"_")}var Gn=/^[cdef][\w-]{21}$/,ge="";function Jn(){try{let e=new Uint8Array(17);(self.crypto||self.msCrypto).getRandomValues(e),e[0]=112+e[0]%16;let n=Yn(e);return Gn.test(n)?n:ge}catch{return ge}}function Yn(e){return qn(e).substr(0,22)}function V(e){return`${e.appName}!${e.appId}`}var at=new Map;function ct(e,t){let n=V(e);ut(n,t),Qn(n,t)}function ut(e,t){let n=at.get(e);if(n)for(let r of n)r(t)}function Qn(e,t){let n=Xn();n&&n.postMessage({key:e,fid:t}),Zn()}var I=null;function Xn(){return!I&&"BroadcastChannel"in self&&(I=new BroadcastChannel("[Firebase] FID Change"),I.onmessage=e=>{ut(e.data.key,e.data.fid)}),I}function Zn(){at.size===0&&I&&(I.close(),I=null)}var er="firebase-installations-database",tr=1,v="firebase-installations-store",he=null;function be(){return he||(he=S(er,tr,{upgrade:(e,t)=>{switch(t){case 0:e.createObjectStore(v)}}})),he}async function U(e,t){let n=V(e),i=(await be()).transaction(v,"readwrite"),o=i.objectStore(v),s=await o.get(n);return await o.put(t,n),await i.done,(!s||s.fid!==t.fid)&&ct(e,t.fid),t}async function ft(e){let t=V(e),r=(await be()).transaction(v,"readwrite");await r.objectStore(v).delete(t),await r.done}async function z(e,t){let n=V(e),i=(await be()).transaction(v,"readwrite"),o=i.objectStore(v),s=await o.get(n),c=t(s);return c===void 0?await o.delete(n):await o.put(c,n),await i.done,c&&(!s||s.fid!==c.fid)&&ct(e,c.fid),c}async function we(e){let t,n=await z(e.appConfig,r=>{let i=nr(r),o=rr(e,i);return t=o.registrationPromise,o.installationEntry});return n.fid===ge?{installationEntry:await t}:{installationEntry:n,registrationPromise:t}}function nr(e){let t=e||{fid:Jn(),registrationStatus:0};return lt(t)}function rr(e,t){if(t.registrationStatus===0){if(!navigator.onLine){let i=Promise.reject(A.create("app-offline"));return{installationEntry:t,registrationPromise:i}}let n={fid:t.fid,registrationStatus:1,registrationTime:Date.now()},r=ir(e,n);return{installationEntry:n,registrationPromise:r}}else return t.registrationStatus===1?{installationEntry:t,registrationPromise:or(e)}:{installationEntry:t}}async function ir(e,t){try{let n=await Kn(e,t);return U(e.appConfig,n)}catch(n){throw et(n)&&n.customData.serverCode===409?await ft(e.appConfig):await U(e.appConfig,{fid:t.fid,registrationStatus:0}),n}}async function or(e){let t=await Ge(e.appConfig);for(;t.registrationStatus===1;)await st(100),t=await Ge(e.appConfig);if(t.registrationStatus===0){let{installationEntry:n,registrationPromise:r}=await we(e);return r||n}return t}function Ge(e){return z(e,t=>{if(!t)throw A.create("installation-not-found");return lt(t)})}function lt(e){return sr(e)?{fid:e.fid,registrationStatus:0}:e}function sr(e){return e.registrationStatus===1&&e.registrationTime+Qe<Date.now()}async function ar({appConfig:e,heartbeatServiceProvider:t},n){let r=cr(e,n),i=Vn(e,n),o=t.getImmediate({optional:!0});if(o){let a=await o.getHeartbeatsHeader();a&&i.append("x-firebase-client",a)}let s={installation:{sdkVersion:Xe,appId:e.appId}},c={method:"POST",headers:i,body:JSON.stringify(s)},u=await ot(()=>fetch(r,c));if(u.ok){let a=await u.json();return nt(a)}else throw await rt("Generate Auth Token",u)}function cr(e,{fid:t}){return`${tt(e)}/${t}/authTokens:generate`}async function ye(e,t=!1){let n,r=await z(e.appConfig,o=>{if(!dt(o))throw A.create("not-registered");let s=o.authToken;if(!t&&lr(s))return o;if(s.requestStatus===1)return n=ur(e,t),o;{if(!navigator.onLine)throw A.create("app-offline");let c=hr(o);return n=fr(e,c),c}});return n?await n:r.authToken}async function ur(e,t){let n=await Je(e.appConfig);for(;n.authToken.requestStatus===1;)await st(100),n=await Je(e.appConfig);let r=n.authToken;return r.requestStatus===0?ye(e,t):r}function Je(e){return z(e,t=>{if(!dt(t))throw A.create("not-registered");let n=t.authToken;return pr(n)?{...t,authToken:{requestStatus:0}}:t})}async function fr(e,t){try{let n=await ar(e,t),r={...t,authToken:n};return await U(e.appConfig,r),n}catch(n){if(et(n)&&(n.customData.serverCode===401||n.customData.serverCode===404))await ft(e.appConfig);else{let r={...t,authToken:{requestStatus:0}};await U(e.appConfig,r)}throw n}}function dt(e){return e!==void 0&&e.registrationStatus===2}function lr(e){return e.requestStatus===2&&!dr(e)}function dr(e){let t=Date.now();return t<e.creationTime||e.creationTime+e.expiresIn<t+$n}function hr(e){let t={requestStatus:1,requestTime:Date.now()};return{...e,authToken:t}}function pr(e){return e.requestStatus===1&&e.requestTime+Qe<Date.now()}async function gr(e){let t=e,{installationEntry:n,registrationPromise:r}=await we(t);return r?r.catch(console.error):ye(t).catch(console.error),n.fid}async function mr(e,t=!1){let n=e;return await br(n),(await ye(n,t)).token}async function br(e){let{registrationPromise:t}=await we(e);t&&await t}function wr(e){if(!e||!e.options)throw pe("App Configuration");if(!e.name)throw pe("App Name");let t=["projectId","apiKey","appId"];for(let n of t)if(!e.options[n])throw pe(n);return{appName:e.name,projectId:e.options.projectId,apiKey:e.options.apiKey,appId:e.options.appId}}function pe(e){return A.create("missing-app-config-values",{valueName:e})}var ht="installations",yr="installations-internal",_r=e=>{let t=e.getProvider("app").getImmediate(),n=wr(t),r=k(t,"heartbeat");return{app:t,appConfig:n,heartbeatServiceProvider:r,_delete:()=>Promise.resolve()}},Er=e=>{let t=e.getProvider("app").getImmediate(),n=k(t,ht).getImmediate();return{getId:()=>gr(n),getToken:i=>mr(n,i)}};function Sr(){_(new l(ht,_r,"PUBLIC")),_(new l(yr,Er,"PRIVATE"))}Sr();y(Ye,me);y(Ye,me,"esm2020");var bt="BDOU99-h67HcA6JeFXHbSNMu7e2yNNu3RzoMj8TM4W88jITfq7ZmPvIM1Iv-4_l2LxQcYwhqby2xGpWwzjfAnG4",Ir="https://fcmregistrations.googleapis.com/v1",wt="FCM_MSG",Ar="google.c.a.c_id",vr=3,Dr=1,W;(function(e){e[e.DATA_MESSAGE=1]="DATA_MESSAGE",e[e.DISPLAY_NOTIFICATION=3]="DISPLAY_NOTIFICATION"})(W||(W={}));var K;(function(e){e.PUSH_RECEIVED="push-received",e.NOTIFICATION_CLICKED="notification-clicked"})(K||(K={}));function b(e){let t=new Uint8Array(e);return btoa(String.fromCharCode(...t)).replace(/=/g,"").replace(/\+/g,"-").replace(/\//g,"_")}function Cr(e){let t="=".repeat((4-e.length%4)%4),n=(e+t).replace(/\-/g,"+").replace(/_/g,"/"),r=atob(n),i=new Uint8Array(r.length);for(let o=0;o<r.length;++o)i[o]=r.charCodeAt(o);return i}var _e="fcm_token_details_db",Tr=5,pt="fcm_token_object_Store";async function kr(e){if("databases"in indexedDB&&!(await indexedDB.databases()).map(o=>o.name).includes(_e))return null;let t=null;return(await S(_e,Tr,{upgrade:async(r,i,o,s)=>{if(i<2||!r.objectStoreNames.contains(pt))return;let c=s.objectStore(pt),u=await c.index("fcmSenderId").get(e);if(await c.clear(),!!u){if(i===2){let a=u;if(!a.auth||!a.p256dh||!a.endpoint)return;t={token:a.fcmToken,createTime:a.createTime??Date.now(),subscriptionOptions:{auth:a.auth,p256dh:a.p256dh,endpoint:a.endpoint,swScope:a.swScope,vapidKey:typeof a.vapidKey=="string"?a.vapidKey:b(a.vapidKey)}}}else if(i===3){let a=u;t={token:a.fcmToken,createTime:a.createTime,subscriptionOptions:{auth:b(a.auth),p256dh:b(a.p256dh),endpoint:a.endpoint,swScope:a.swScope,vapidKey:b(a.vapidKey)}}}else if(i===4){let a=u;t={token:a.fcmToken,createTime:a.createTime,subscriptionOptions:{auth:b(a.auth),p256dh:b(a.p256dh),endpoint:a.endpoint,swScope:a.swScope,vapidKey:b(a.vapidKey)}}}}}})).close(),await j(_e),await j("fcm_vapid_details_db"),await j("undefined"),Or(t)?t:null}function Or(e){if(!e||!e.subscriptionOptions)return!1;let{subscriptionOptions:t}=e;return typeof e.createTime=="number"&&e.createTime>0&&typeof e.token=="string"&&e.token.length>0&&typeof t.auth=="string"&&t.auth.length>0&&typeof t.p256dh=="string"&&t.p256dh.length>0&&typeof t.endpoint=="string"&&t.endpoint.length>0&&typeof t.swScope=="string"&&t.swScope.length>0&&typeof t.vapidKey=="string"&&t.vapidKey.length>0}var Nr="firebase-messaging-database",xr=1,D="firebase-messaging-store",Ee=null;function Ae(){return Ee||(Ee=S(Nr,xr,{upgrade:(e,t)=>{switch(t){case 0:e.createObjectStore(D)}}})),Ee}async function ve(e){let t=Ce(e),r=await(await Ae()).transaction(D).objectStore(D).get(t);if(r)return r;{let i=await kr(e.appConfig.senderId);if(i)return await De(e,i),i}}async function De(e,t){let n=Ce(e),i=(await Ae()).transaction(D,"readwrite");return await i.objectStore(D).put(t,n),await i.done,t}async function Mr(e){let t=Ce(e),r=(await Ae()).transaction(D,"readwrite");await r.objectStore(D).delete(t),await r.done}function Ce({appConfig:e}){return e.appId}var Br={"missing-app-config-values":'Missing App configuration value: "{$valueName}"',"only-available-in-window":"This method is available in a Window context.","only-available-in-sw":"This method is available in a service worker context.","permission-default":"The notification permission was not granted and dismissed instead.","permission-blocked":"The notification permission was not granted and blocked instead.","unsupported-browser":"This browser doesn't support the API's required to use the Firebase SDK.","indexed-db-unsupported":"This browser doesn't support indexedDb.open() (ex. Safari iFrame, Firefox Private Browsing, etc)","failed-service-worker-registration":"We are unable to register the default service worker. {$browserErrorMessage}","token-subscribe-failed":"A problem occurred while subscribing the user to FCM: {$errorInfo}","token-subscribe-no-token":"FCM returned no token when subscribing the user to push.","token-unsubscribe-failed":"A problem occurred while unsubscribing the user from FCM: {$errorInfo}","token-update-failed":"A problem occurred while updating the user from FCM: {$errorInfo}","token-update-no-token":"FCM returned no token when updating the user to push.","use-sw-after-get-token":"The useServiceWorker() method may only be called once and must be called before calling getToken() to ensure your service worker is used.","invalid-sw-registration":"The input to useServiceWorker() must be a ServiceWorkerRegistration.","invalid-bg-handler":"The input to setBackgroundMessageHandler() must be a function.","invalid-vapid-key":"The public VAPID key must be a string.","use-vapid-key-after-get-token":"The usePublicVapidKey() method may only be called once and must be called before calling getToken() to ensure your VAPID key is used."},d=new g("messaging","Messaging",Br);async function Rr(e,t){let n=await ke(e),r=_t(t),i={method:"POST",headers:n,body:JSON.stringify(r)},o;try{o=await(await fetch(Te(e.appConfig),i)).json()}catch(s){throw d.create("token-subscribe-failed",{errorInfo:s?.toString()})}if(o.error){let s=o.error.message;throw d.create("token-subscribe-failed",{errorInfo:s})}if(!o.token)throw d.create("token-subscribe-no-token");return o.token}async function Lr(e,t){let n=await ke(e),r=_t(t.subscriptionOptions),i={method:"PATCH",headers:n,body:JSON.stringify(r)},o;try{o=await(await fetch(`${Te(e.appConfig)}/${t.token}`,i)).json()}catch(s){throw d.create("token-update-failed",{errorInfo:s?.toString()})}if(o.error){let s=o.error.message;throw d.create("token-update-failed",{errorInfo:s})}if(!o.token)throw d.create("token-update-no-token");return o.token}async function yt(e,t){let r={method:"DELETE",headers:await ke(e)};try{let o=await(await fetch(`${Te(e.appConfig)}/${t}`,r)).json();if(o.error){let s=o.error.message;throw d.create("token-unsubscribe-failed",{errorInfo:s})}}catch(i){throw d.create("token-unsubscribe-failed",{errorInfo:i?.toString()})}}function Te({projectId:e}){return`${Ir}/projects/${e}/registrations`}async function ke({appConfig:e,installations:t}){let n=await t.getToken();return new Headers({"Content-Type":"application/json",Accept:"application/json","x-goog-api-key":e.apiKey,"x-goog-firebase-installations-auth":`FIS ${n}`})}function _t({p256dh:e,auth:t,endpoint:n,vapidKey:r}){let i={web:{endpoint:n,auth:t,p256dh:e}};return r!==bt&&(i.web.applicationPubKey=r),i}var Pr=10080*60*1e3;async function Fr(e){let t=await jr(e.swRegistration,e.vapidKey),n={vapidKey:e.vapidKey,swScope:e.swRegistration.scope,endpoint:t.endpoint,auth:b(t.getKey("auth")),p256dh:b(t.getKey("p256dh"))},r=await ve(e.firebaseDependencies);if(r){if(Hr(r.subscriptionOptions,n))return Date.now()>=r.createTime+Pr?$r(e,{token:r.token,createTime:Date.now(),subscriptionOptions:n}):r.token;try{await yt(e.firebaseDependencies,r.token)}catch(i){console.warn(i)}return mt(e.firebaseDependencies,n)}else return mt(e.firebaseDependencies,n)}async function gt(e){let t=await ve(e.firebaseDependencies);t&&(await yt(e.firebaseDependencies,t.token),await Mr(e.firebaseDependencies));let n=await e.swRegistration.pushManager.getSubscription();return n?n.unsubscribe():!0}async function $r(e,t){try{let n=await Lr(e.firebaseDependencies,t),r={...t,token:n,createTime:Date.now()};return await De(e.firebaseDependencies,r),n}catch(n){throw n}}async function mt(e,t){let r={token:await Rr(e,t),createTime:Date.now(),subscriptionOptions:t};return await De(e,r),r.token}async function jr(e,t){let n=await e.pushManager.getSubscription();return n||e.pushManager.subscribe({userVisibleOnly:!0,applicationServerKey:Cr(t)})}function Hr(e,t){let n=t.vapidKey===e.vapidKey,r=t.endpoint===e.endpoint,i=t.auth===e.auth,o=t.p256dh===e.p256dh;return n&&r&&i&&o}function Ur(e){let t={from:e.from,collapseKey:e.collapse_key,messageId:e.fcmMessageId};return Vr(t,e),zr(t,e),Wr(t,e),t}function Vr(e,t){if(!t.notification)return;e.notification={};let n=t.notification.title;n&&(e.notification.title=n);let r=t.notification.body;r&&(e.notification.body=r);let i=t.notification.image;i&&(e.notification.image=i);let o=t.notification.icon;o&&(e.notification.icon=o)}function zr(e,t){t.data&&(e.data=t.data)}function Wr(e,t){if(!t.fcmOptions&&!t.notification?.click_action)return;e.fcmOptions={};let n=t.fcmOptions?.link??t.notification?.click_action;n&&(e.fcmOptions.link=n);let r=t.fcmOptions?.analytics_label;r&&(e.fcmOptions.analyticsLabel=r)}function Kr(e){return typeof e=="object"&&!!e&&Ar in e}function qr(e){return new Promise(t=>{setTimeout(t,e)})}Xr("AzSCbw63g1R0nCw85jG8","Iaya3yLKwmgvh7cF0q4");async function Gr(e,t){let n=Jr(t,await e.firebaseDependencies.installations.getId());Yr(e,n,t.productId)}function Jr(e,t){let n={};return e.from&&(n.project_number=e.from),e.fcmMessageId&&(n.message_id=e.fcmMessageId),n.instance_id=t,e.notification?n.message_type=W.DISPLAY_NOTIFICATION.toString():n.message_type=W.DATA_MESSAGE.toString(),n.sdk_platform=vr.toString(),n.package_name=self.origin.replace(/(^\w+:|^)\/\//,""),e.collapse_key&&(n.collapse_key=e.collapse_key),n.event=Dr.toString(),e.fcmOptions?.analytics_label&&(n.analytics_label=e.fcmOptions?.analytics_label),n}function Yr(e,t,n){let r={};r.event_time_ms=Math.floor(Date.now()).toString(),r.source_extension_json_proto3=JSON.stringify({messaging_client_event:t}),n&&(r.compliance_data=Qr(n)),e.logEvents.push(r)}function Qr(e){return{privacy_context:{prequest:{origin_associated_product_id:e}}}}function Xr(e,t){let n=[];for(let r=0;r<e.length;r++)n.push(e.charAt(r)),r<t.length&&n.push(t.charAt(r));return n.join("")}async function Zr(e,t){let{newSubscription:n}=e;if(!n){await gt(t);return}let r=await ve(t.firebaseDependencies);await gt(t),t.vapidKey=r?.subscriptionOptions?.vapidKey??bt,await Fr(t)}async function ei(e,t){let n=ri(e);if(!n)return;t.deliveryMetricsExportedToBigQueryEnabled&&await Gr(t,n);let r=await Et();if(oi(r))return si(r,n);if(n.notification&&await ai(ni(n)),!!t&&t.onBackgroundMessageHandler){let i=Ur(n);typeof t.onBackgroundMessageHandler=="function"?await t.onBackgroundMessageHandler(i):t.onBackgroundMessageHandler.next(i)}}async function ti(e){let t=e.notification?.data?.[wt];if(t){if(e.action)return}else return;e.stopImmediatePropagation(),e.notification.close();let n=ci(t);if(!n)return;let r=new URL(n,self.location.href),i=new URL(self.location.origin);if(r.host!==i.host)return;let o=await ii(r);if(o?o=await o.focus():(o=await self.clients.openWindow(n),await qr(3e3)),!!o)return t.messageType=K.NOTIFICATION_CLICKED,t.isFirebaseMessaging=!0,o.postMessage(t)}function ni(e){let t={...e.notification};return t.data={[wt]:e},t}function ri({data:e}){if(!e)return null;try{return e.json()}catch{return null}}async function ii(e){let t=await Et();for(let n of t){let r=new URL(n.url,self.location.href);if(e.host===r.host)return n}return null}function oi(e){return e.some(t=>t.visibilityState==="visible"&&!t.url.startsWith("chrome-extension://"))}function si(e,t){t.isFirebaseMessaging=!0,t.messageType=K.PUSH_RECEIVED;for(let n of e)n.postMessage(t)}function Et(){return self.clients.matchAll({type:"window",includeUncontrolled:!0})}function ai(e){let{actions:t}=e,{maxActions:n}=Notification;return t&&n&&t.length>n&&console.warn(`This browser only supports ${n} actions. The remaining actions will not be displayed.`),self.registration.showNotification(e.title??"",e)}function ci(e){let t=e.fcmOptions?.link??e.notification?.click_action;return t||(Kr(e.data)?self.location.origin:null)}function ui(e){if(!e||!e.options)throw Se("App Configuration Object");if(!e.name)throw Se("App Name");let t=["projectId","apiKey","appId","messagingSenderId"],{options:n}=e;for(let r of t)if(!n[r])throw Se(r);return{appName:e.name,projectId:n.projectId,apiKey:n.apiKey,appId:n.appId,senderId:n.messagingSenderId}}function Se(e){return d.create("missing-app-config-values",{valueName:e})}var Ie=class{constructor(t,n,r){this.deliveryMetricsExportedToBigQueryEnabled=!1,this.onBackgroundMessageHandler=null,this.onMessageHandler=null,this.logEvents=[],this.isLogServiceStarted=!1;let i=ui(t);this.firebaseDependencies={app:t,appConfig:i,installations:n,analyticsProvider:r}}_delete(){return Promise.resolve()}};var fi=e=>{let t=new Ie(e.getProvider("app").getImmediate(),e.getProvider("installations-internal").getImmediate(),e.getProvider("analytics-internal"));return self.addEventListener("push",n=>{n.waitUntil(ei(n,t))}),self.addEventListener("pushsubscriptionchange",n=>{n.waitUntil(Zr(n,t))}),self.addEventListener("notificationclick",n=>{n.waitUntil(ti(n))}),t};function li(){_(new l("messaging-sw",fi,"PUBLIC"))}async function di(){return B()&&await R()&&"PushManager"in self&&"Notification"in self&&ServiceWorkerRegistration.prototype.hasOwnProperty("showNotification")&&PushSubscription.prototype.hasOwnProperty("getKey")}function hi(e,t){if(self.document!==void 0)throw d.create("only-available-in-sw");return e.onBackgroundMessageHandler=t,()=>{e.onBackgroundMessageHandler=null}}function St(e=de()){return di().then(t=>{if(!t)throw d.create("unsupported-browser")},t=>{throw d.create("indexed-db-unsupported")}),k(Y(e),"messaging-sw").getImmediate()}function It(e,t){return e=Y(e),hi(e,t)}li();var pi=le({apiKey:"AIzaSyBGjgLk6cXLPSDmk3p4mmbJ3bo4zSGiqQU",authDomain:"pointlab.vercel.app",projectId:"pointlab-96310",storageBucket:"pointlab-96310.firebasestorage.app",messagingSenderId:"368940164446",appId:"1:368940164446:web:5c0ecfb34e4ab411139bcf"}),gi=St(pi);It(gi,e=>{let t=e.notification?.title??"\u307D\u3044\u30ED\u30DC \u30EC\u30FC\u30C0\u30FC",n=e.notification?.body??"";self.registration.showNotification(t,{body:n,icon:"/calendar/icon-192.png",badge:"/calendar/icon-192.png",tag:"poirobo-radar",data:e.data??{}})});self.addEventListener("notificationclick",e=>{e.notification.close(),e.waitUntil(self.clients.matchAll({type:"window",includeUncontrolled:!0}).then(t=>{for(let n of t)if(n.url.includes("pointlab.vercel.app")&&"focus"in n)return n.focus();return self.clients.openWindow("https://pointlab.vercel.app/calendar/")}))});})();
/*! Bundled license information:

@firebase/util/dist/index.esm.js:
@firebase/util/dist/index.esm.js:
@firebase/util/dist/index.esm.js:
@firebase/util/dist/index.esm.js:
@firebase/util/dist/index.esm.js:
@firebase/util/dist/index.esm.js:
@firebase/util/dist/index.esm.js:
@firebase/util/dist/index.esm.js:
@firebase/util/dist/index.esm.js:
@firebase/util/dist/index.esm.js:
@firebase/util/dist/index.esm.js:
@firebase/logger/dist/esm/index.esm.js:
@firebase/messaging/dist/esm/index.sw.esm.js:
@firebase/messaging/dist/esm/index.sw.esm.js:
  (**
   * @license
   * Copyright 2017 Google LLC
   *
   * Licensed under the Apache License, Version 2.0 (the "License");
   * you may not use this file except in compliance with the License.
   * You may obtain a copy of the License at
   *
   *   http://www.apache.org/licenses/LICENSE-2.0
   *
   * Unless required by applicable law or agreed to in writing, software
   * distributed under the License is distributed on an "AS IS" BASIS,
   * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
   * See the License for the specific language governing permissions and
   * limitations under the License.
   *)

@firebase/util/dist/index.esm.js:
@firebase/util/dist/index.esm.js:
  (**
   * @license
   * Copyright 2022 Google LLC
   *
   * Licensed under the Apache License, Version 2.0 (the "License");
   * you may not use this file except in compliance with the License.
   * You may obtain a copy of the License at
   *
   *   http://www.apache.org/licenses/LICENSE-2.0
   *
   * Unless required by applicable law or agreed to in writing, software
   * distributed under the License is distributed on an "AS IS" BASIS,
   * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
   * See the License for the specific language governing permissions and
   * limitations under the License.
   *)

@firebase/util/dist/index.esm.js:
  (**
   * @license
   * Copyright 2017 Google LLC
   *
   * Licensed under the Apache License, Version 2.0 (the "License");
   * you may not use this file except in compliance with the License.
   * You may obtain a copy of the License at
   *
   *   http://www.apache.org/licenses/LICENSE-2.0
   *
   * Unless required by applicable law or agreed to in writing, software
   * distributed under the License is distributed on an "AS IS" BASIS,
   * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
   * See the License for the specific language governing permissions and
   * limitations under the License.
   *)
  (**
   * @license
   * Copyright 2021 Google LLC
   *
   * Licensed under the Apache License, Version 2.0 (the "License");
   * you may not use this file except in compliance with the License.
   * You may obtain a copy of the License at
   *
   *   http://www.apache.org/licenses/LICENSE-2.0
   *
   * Unless required by applicable law or agreed to in writing, software
   * distributed under the License is distributed on an "AS IS" BASIS,
   * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
   * See the License for the specific language governing permissions and
   * limitations under the License.
   *)

@firebase/util/dist/index.esm.js:
@firebase/component/dist/esm/index.esm.js:
@firebase/app/dist/esm/index.esm.js:
@firebase/app/dist/esm/index.esm.js:
@firebase/app/dist/esm/index.esm.js:
@firebase/installations/dist/esm/index.esm.js:
@firebase/installations/dist/esm/index.esm.js:
@firebase/installations/dist/esm/index.esm.js:
@firebase/installations/dist/esm/index.esm.js:
  (**
   * @license
   * Copyright 2019 Google LLC
   *
   * Licensed under the Apache License, Version 2.0 (the "License");
   * you may not use this file except in compliance with the License.
   * You may obtain a copy of the License at
   *
   *   http://www.apache.org/licenses/LICENSE-2.0
   *
   * Unless required by applicable law or agreed to in writing, software
   * distributed under the License is distributed on an "AS IS" BASIS,
   * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
   * See the License for the specific language governing permissions and
   * limitations under the License.
   *)

@firebase/util/dist/index.esm.js:
firebase/app/dist/esm/index.esm.js:
@firebase/installations/dist/esm/index.esm.js:
  (**
   * @license
   * Copyright 2020 Google LLC
   *
   * Licensed under the Apache License, Version 2.0 (the "License");
   * you may not use this file except in compliance with the License.
   * You may obtain a copy of the License at
   *
   *   http://www.apache.org/licenses/LICENSE-2.0
   *
   * Unless required by applicable law or agreed to in writing, software
   * distributed under the License is distributed on an "AS IS" BASIS,
   * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
   * See the License for the specific language governing permissions and
   * limitations under the License.
   *)

@firebase/util/dist/index.esm.js:
  (**
   * @license
   * Copyright 2021 Google LLC
   *
   * Licensed under the Apache License, Version 2.0 (the "License");
   * you may not use this file except in compliance with the License.
   * You may obtain a copy of the License at
   *
   *   http://www.apache.org/licenses/LICENSE-2.0
   *
   * Unless required by applicable law or agreed to in writing, software
   * distributed under the License is distributed on an "AS IS" BASIS,
   * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
   * See the License for the specific language governing permissions and
   * limitations under the License.
   *)
  (**
   * @license
   * Copyright 2025 Google LLC
   *
   * Licensed under the Apache License, Version 2.0 (the "License");
   * you may not use this file except in compliance with the License.
   * You may obtain a copy of the License at
   *
   *   http://www.apache.org/licenses/LICENSE-2.0
   *
   * Unless required by applicable law or agreed to in writing, software
   * distributed under the License is distributed on an "AS IS" BASIS,
   * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
   * See the License for the specific language governing permissions and
   * limitations under the License.
   *)

@firebase/util/dist/index.esm.js:
  (**
   * @license
   * Copyright 2025 Google LLC
   *
   * Licensed under the Apache License, Version 2.0 (the "License");
   * you may not use this file except in compliance with the License.
   * You may obtain a copy of the License at
   *
   *   http://www.apache.org/licenses/LICENSE-2.0
   *
   * Unless required by applicable law or agreed to in writing, software
   * distributed under the License is distributed on an "AS IS" BASIS,
   * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
   * See the License for the specific language governing permissions and
   * limitations under the License.
   *)

@firebase/app/dist/esm/index.esm.js:
  (**
   * @license
   * Copyright 2019 Google LLC
   *
   * Licensed under the Apache License, Version 2.0 (the "License");
   * you may not use this file except in compliance with the License.
   * You may obtain a copy of the License at
   *
   *   http://www.apache.org/licenses/LICENSE-2.0
   *
   * Unless required by applicable law or agreed to in writing, software
   * distributed under the License is distributed on an "AS IS" BASIS,
   * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
   * See the License for the specific language governing permissions and
   * limitations under the License.
   *)
  (**
   * @license
   * Copyright 2023 Google LLC
   *
   * Licensed under the Apache License, Version 2.0 (the "License");
   * you may not use this file except in compliance with the License.
   * You may obtain a copy of the License at
   *
   *   http://www.apache.org/licenses/LICENSE-2.0
   *
   * Unless required by applicable law or agreed to in writing, software
   * distributed under the License is distributed on an "AS IS" BASIS,
   * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
   * See the License for the specific language governing permissions and
   * limitations under the License.
   *)

@firebase/app/dist/esm/index.esm.js:
  (**
   * @license
   * Copyright 2021 Google LLC
   *
   * Licensed under the Apache License, Version 2.0 (the "License");
   * you may not use this file except in compliance with the License.
   * You may obtain a copy of the License at
   *
   *   http://www.apache.org/licenses/LICENSE-2.0
   *
   * Unless required by applicable law or agreed to in writing, software
   * distributed under the License is distributed on an "AS IS" BASIS,
   * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
   * See the License for the specific language governing permissions and
   * limitations under the License.
   *)
  (**
   * @license
   * Copyright 2019 Google LLC
   *
   * Licensed under the Apache License, Version 2.0 (the "License");
   * you may not use this file except in compliance with the License.
   * You may obtain a copy of the License at
   *
   *   http://www.apache.org/licenses/LICENSE-2.0
   *
   * Unless required by applicable law or agreed to in writing, software
   * distributed under the License is distributed on an "AS IS" BASIS,
   * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
   * See the License for the specific language governing permissions and
   * limitations under the License.
   *)

@firebase/installations/dist/esm/index.esm.js:
  (**
   * @license
   * Copyright 2019 Google LLC
   *
   * Licensed under the Apache License, Version 2.0 (the "License");
   * you may not use this file except in compliance with the License.
   * You may obtain a copy of the License at
   *
   *   http://www.apache.org/licenses/LICENSE-2.0
   *
   * Unless required by applicable law or agreed to in writing, software
   * distributed under the License is distributed on an "AS IS" BASIS,
   * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
   * See the License for the specific language governing permissions and
   * limitations under the License.
   *)
  (**
   * @license
   * Copyright 2020 Google LLC
   *
   * Licensed under the Apache License, Version 2.0 (the "License");
   * you may not use this file except in compliance with the License.
   * You may obtain a copy of the License at
   *
   *   http://www.apache.org/licenses/LICENSE-2.0
   *
   * Unless required by applicable law or agreed to in writing, software
   * distributed under the License is distributed on an "AS IS" BASIS,
   * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
   * See the License for the specific language governing permissions and
   * limitations under the License.
   *)

@firebase/messaging/dist/esm/index.sw.esm.js:
  (**
   * @license
   * Copyright 2019 Google LLC
   *
   * Licensed under the Apache License, Version 2.0 (the "License");
   * you may not use this file except in compliance with the License.
   * You may obtain a copy of the License at
   *
   *   http://www.apache.org/licenses/LICENSE-2.0
   *
   * Unless required by applicable law or agreed to in writing, software
   * distributed under the License is distributed on an "AS IS" BASIS,
   * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
   * See the License for the specific language governing permissions and
   * limitations under the License.
   *)
  (**
   * @license
   * Copyright 2018 Google LLC
   *
   * Licensed under the Apache License, Version 2.0 (the "License"); you may not use this file except
   * in compliance with the License. You may obtain a copy of the License at
   *
   * http://www.apache.org/licenses/LICENSE-2.0
   *
   * Unless required by applicable law or agreed to in writing, software distributed under the License
   * is distributed on an "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express
   * or implied. See the License for the specific language governing permissions and limitations under
   * the License.
   *)
  (**
   * @license
   * Copyright 2017 Google LLC
   *
   * Licensed under the Apache License, Version 2.0 (the "License");
   * you may not use this file except in compliance with the License.
   * You may obtain a copy of the License at
   *
   *   http://www.apache.org/licenses/LICENSE-2.0
   *
   * Unless required by applicable law or agreed to in writing, software
   * distributed under the License is distributed on an "AS IS" BASIS,
   * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
   * See the License for the specific language governing permissions and
   * limitations under the License.
   *)
  (**
   * @license
   * Copyright 2020 Google LLC
   *
   * Licensed under the Apache License, Version 2.0 (the "License");
   * you may not use this file except in compliance with the License.
   * You may obtain a copy of the License at
   *
   *   http://www.apache.org/licenses/LICENSE-2.0
   *
   * Unless required by applicable law or agreed to in writing, software
   * distributed under the License is distributed on an "AS IS" BASIS,
   * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
   * See the License for the specific language governing permissions and
   * limitations under the License.
   *)
*/
