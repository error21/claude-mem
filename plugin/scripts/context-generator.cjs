"use strict";var ci=Object.create;var ot=Object.defineProperty;var di=Object.getOwnPropertyDescriptor;var ui=Object.getOwnPropertyNames;var pi=Object.getPrototypeOf,mi=Object.prototype.hasOwnProperty;var K=(s,e)=>()=>(s&&(e=s(s=0)),e);var it=(s,e)=>{for(var t in e)ot(s,t,{get:e[t],enumerable:!0})},qs=(s,e,t,r)=>{if(e&&typeof e=="object"||typeof e=="function")for(let n of ui(e))!mi.call(s,n)&&n!==t&&ot(s,n,{get:()=>e[n],enumerable:!(r=di(e,n))||r.enumerable});return s};var me=(s,e,t)=>(t=s!=null?ci(pi(s)):{},qs(e||!s||!s.__esModule?ot(t,"default",{value:s,enumerable:!0}):t,s)),Ys=s=>qs(ot({},"__esModule",{value:!0}),s);var be,Ve,Ks,Xt,Vs,Gt,S,oe=K(()=>{"use strict";be=require("fs"),Ve=require("path"),Ks=require("os"),Xt=(o=>(o[o.DEBUG=0]="DEBUG",o[o.INFO=1]="INFO",o[o.WARN=2]="WARN",o[o.ERROR=3]="ERROR",o[o.SILENT=4]="SILENT",o))(Xt||{}),Vs=(0,Ve.join)((0,Ks.homedir)(),".claude-mem"),Gt=class{level=null;useColor;logFilePath=null;logFileInitialized=!1;constructor(){this.useColor=process.stdout.isTTY??!1}ensureLogFileInitialized(){if(!this.logFileInitialized){this.logFileInitialized=!0;try{let e=(0,Ve.join)(Vs,"logs");(0,be.existsSync)(e)||(0,be.mkdirSync)(e,{recursive:!0});let t=new Date().toISOString().split("T")[0];this.logFilePath=(0,Ve.join)(e,`claude-mem-${t}.log`)}catch(e){console.error("[LOGGER] Failed to initialize log file:",e),this.logFilePath=null}}}getLevel(){if(this.level===null)try{let e=(0,Ve.join)(Vs,"settings.json");if((0,be.existsSync)(e)){let t=(0,be.readFileSync)(e,"utf-8"),n=(JSON.parse(t).CLAUDE_MEM_LOG_LEVEL||"INFO").toUpperCase();this.level=Xt[n]??1}else this.level=1}catch{this.level=1}return this.level}correlationId(e,t){return`obs-${e}-${t}`}sessionId(e){return`session-${e}`}formatData(e){if(e==null)return"";if(typeof e=="string")return e;if(typeof e=="number"||typeof e=="boolean")return e.toString();if(typeof e=="object"){if(e instanceof Error)return this.getLevel()===0?`${e.message}
${e.stack}`:e.message;if(Array.isArray(e))return`[${e.length} items]`;let t=Object.keys(e);return t.length===0?"{}":t.length<=3?JSON.stringify(e):`{${t.length} keys: ${t.slice(0,3).join(", ")}...}`}return String(e)}formatTool(e,t){if(!t)return e;let r=t;if(typeof t=="string")try{r=JSON.parse(t)}catch{r=t}if(e==="Bash"&&r.command)return`${e}(${r.command})`;if(r.file_path)return`${e}(${r.file_path})`;if(r.notebook_path)return`${e}(${r.notebook_path})`;if(e==="Glob"&&r.pattern)return`${e}(${r.pattern})`;if(e==="Grep"&&r.pattern)return`${e}(${r.pattern})`;if(r.url)return`${e}(${r.url})`;if(r.query)return`${e}(${r.query})`;if(e==="Task"){if(r.subagent_type)return`${e}(${r.subagent_type})`;if(r.description)return`${e}(${r.description})`}return e==="Skill"&&r.skill?`${e}(${r.skill})`:e==="LSP"&&r.operation?`${e}(${r.operation})`:e}formatTimestamp(e){let t=e.getFullYear(),r=String(e.getMonth()+1).padStart(2,"0"),n=String(e.getDate()).padStart(2,"0"),o=String(e.getHours()).padStart(2,"0"),i=String(e.getMinutes()).padStart(2,"0"),a=String(e.getSeconds()).padStart(2,"0"),d=String(e.getMilliseconds()).padStart(3,"0");return`${t}-${r}-${n} ${o}:${i}:${a}.${d}`}log(e,t,r,n,o){if(e<this.getLevel())return;this.ensureLogFileInitialized();let i=this.formatTimestamp(new Date),a=Xt[e].padEnd(5),d=t.padEnd(6),m="";n?.correlationId?m=`[${n.correlationId}] `:n?.sessionId&&(m=`[session-${n.sessionId}] `);let l="";o!=null&&(o instanceof Error?l=this.getLevel()===0?`
${o.message}
${o.stack}`:` ${o.message}`:this.getLevel()===0&&typeof o=="object"?l=`
`+JSON.stringify(o,null,2):l=" "+this.formatData(o));let g="";if(n){let{sessionId:p,memorySessionId:y,correlationId:_,...f}=n;Object.keys(f).length>0&&(g=` {${Object.entries(f).map(([A,v])=>`${A}=${v}`).join(", ")}}`)}let h=`[${i}] [${a}] [${d}] ${m}${r}${g}${l}`;if(this.logFilePath)try{(0,be.appendFileSync)(this.logFilePath,h+`
`,"utf8")}catch(p){process.stderr.write(`[LOGGER] Failed to write to log file: ${p}
`)}else process.stderr.write(h+`
`)}debug(e,t,r,n){this.log(0,e,t,r,n)}info(e,t,r,n){this.log(1,e,t,r,n)}warn(e,t,r,n){this.log(2,e,t,r,n)}error(e,t,r,n){this.log(3,e,t,r,n)}dataIn(e,t,r,n){this.info(e,`\u2192 ${t}`,r,n)}dataOut(e,t,r,n){this.info(e,`\u2190 ${t}`,r,n)}success(e,t,r,n){this.info(e,`\u2713 ${t}`,r,n)}failure(e,t,r,n){this.error(e,`\u2717 ${t}`,r,n)}timing(e,t,r,n){this.info(e,`\u23F1 ${t}`,n,{duration:`${r}ms`})}happyPathError(e,t,r,n,o=""){let m=((new Error().stack||"").split(`
`)[2]||"").match(/at\s+(?:.*\s+)?\(?([^:]+):(\d+):(\d+)\)?/),l=m?`${m[1].split("/").pop()}:${m[2]}`:"unknown",g={...r,location:l};return this.warn(e,`[HAPPY-PATH] ${t}`,g,n),o}},S=new Gt});var zs,Zs,er=K(()=>{"use strict";zs="bugfix,feature,refactor,discovery,decision,change",Zs="how-it-works,why-it-exists,what-changed,problem-solution,gotcha,pattern,trade-off"});var ge,at,tr,Re,ct=K(()=>{"use strict";ge=require("fs"),at=require("path"),tr=require("os");er();Re=class{static DEFAULTS={CLAUDE_MEM_MODEL:"claude-sonnet-4-5",CLAUDE_MEM_CONTEXT_OBSERVATIONS:"50",CLAUDE_MEM_WORKER_PORT:"37777",CLAUDE_MEM_WORKER_HOST:"127.0.0.1",CLAUDE_MEM_SKIP_TOOLS:"ListMcpResourcesTool,SlashCommand,Skill,TodoWrite,AskUserQuestion",CLAUDE_MEM_PROVIDER:"claude",CLAUDE_MEM_CLAUDE_AUTH_METHOD:"cli",CLAUDE_MEM_GEMINI_API_KEY:"",CLAUDE_MEM_GEMINI_MODEL:"gemini-2.5-flash-lite",CLAUDE_MEM_GEMINI_RATE_LIMITING_ENABLED:"true",CLAUDE_MEM_OPENROUTER_API_KEY:"",CLAUDE_MEM_OPENROUTER_MODEL:"xiaomi/mimo-v2-flash:free",CLAUDE_MEM_OPENROUTER_SITE_URL:"",CLAUDE_MEM_OPENROUTER_APP_NAME:"claude-mem",CLAUDE_MEM_OPENROUTER_MAX_CONTEXT_MESSAGES:"20",CLAUDE_MEM_OPENROUTER_MAX_TOKENS:"100000",CLAUDE_MEM_DATA_DIR:(0,at.join)((0,tr.homedir)(),".claude-mem"),CLAUDE_MEM_LOG_LEVEL:"INFO",CLAUDE_MEM_PYTHON_VERSION:"3.13",CLAUDE_CODE_PATH:"",CLAUDE_MEM_MODE:"code",CLAUDE_MEM_CONTEXT_SHOW_READ_TOKENS:"false",CLAUDE_MEM_CONTEXT_SHOW_WORK_TOKENS:"false",CLAUDE_MEM_CONTEXT_SHOW_SAVINGS_AMOUNT:"false",CLAUDE_MEM_CONTEXT_SHOW_SAVINGS_PERCENT:"true",CLAUDE_MEM_CONTEXT_OBSERVATION_TYPES:zs,CLAUDE_MEM_CONTEXT_OBSERVATION_CONCEPTS:Zs,CLAUDE_MEM_CONTEXT_FULL_COUNT:"0",CLAUDE_MEM_CONTEXT_FULL_FIELD:"narrative",CLAUDE_MEM_CONTEXT_SESSION_COUNT:"10",CLAUDE_MEM_CONTEXT_SHOW_LAST_SUMMARY:"true",CLAUDE_MEM_CONTEXT_SHOW_LAST_MESSAGE:"false",CLAUDE_MEM_CONTEXT_SHOW_TERMINAL_OUTPUT:"true",CLAUDE_MEM_FOLDER_CLAUDEMD_ENABLED:"false",CLAUDE_MEM_MAX_CONCURRENT_AGENTS:"2",CLAUDE_MEM_EXCLUDED_PROJECTS:"",CLAUDE_MEM_FOLDER_MD_EXCLUDE:"[]",CLAUDE_MEM_CHROMA_ENABLED:"true",CLAUDE_MEM_CHROMA_MODE:"local",CLAUDE_MEM_CHROMA_HOST:"127.0.0.1",CLAUDE_MEM_CHROMA_PORT:"8000",CLAUDE_MEM_CHROMA_SSL:"false",CLAUDE_MEM_CHROMA_API_KEY:"",CLAUDE_MEM_CHROMA_TENANT:"default_tenant",CLAUDE_MEM_CHROMA_DATABASE:"default_database",CLAUDE_MEM_STORAGE_PROVIDER:"sqlite",CLAUDE_MEM_PG_HOST:"127.0.0.1",CLAUDE_MEM_PG_PORT:"5432",CLAUDE_MEM_PG_DATABASE:"claude_mem",CLAUDE_MEM_PG_USER:"",CLAUDE_MEM_PG_PASSWORD:"",CLAUDE_MEM_PG_SSL:"false",CLAUDE_MEM_PG_CONNECTION_STRING:"",CLAUDE_MEM_PG_POOL_MIN:"2",CLAUDE_MEM_PG_POOL_MAX:"10",CLAUDE_MEM_EMBEDDING_PROVIDER:"local",CLAUDE_MEM_EMBEDDING_API_KEY:"",CLAUDE_MEM_EMBEDDING_MODEL:"",CLAUDE_MEM_EMBEDDING_DIMENSIONS:"",CLAUDE_MEM_MARKETPLACE_VENDOR:"thedotmack"};static getAllDefaults(){return{...this.DEFAULTS}}static get(e){return process.env[e]??this.DEFAULTS[e]}static getInt(e){let t=this.get(e);return parseInt(t,10)}static getBool(e){let t=this.get(e);return t==="true"||t===!0}static applyEnvOverrides(e){let t={...e};for(let r of Object.keys(this.DEFAULTS))process.env[r]!==void 0&&(t[r]=process.env[r]);return t}static loadFromFile(e){try{if(!(0,ge.existsSync)(e)){let i=this.getAllDefaults();try{let a=(0,at.dirname)(e);(0,ge.existsSync)(a)||(0,ge.mkdirSync)(a,{recursive:!0}),(0,ge.writeFileSync)(e,JSON.stringify(i,null,2),"utf-8"),console.log("[SETTINGS] Created settings file with defaults:",e)}catch(a){console.warn("[SETTINGS] Failed to create settings file, using in-memory defaults:",e,a)}return this.applyEnvOverrides(i)}let t=(0,ge.readFileSync)(e,"utf-8"),r=JSON.parse(t),n=r;if(r.env&&typeof r.env=="object"){n=r.env;try{(0,ge.writeFileSync)(e,JSON.stringify(n,null,2),"utf-8"),console.log("[SETTINGS] Migrated settings file from nested to flat schema:",e)}catch(i){console.warn("[SETTINGS] Failed to auto-migrate settings file:",e,i)}}let o={...this.DEFAULTS};for(let i of Object.keys(this.DEFAULTS))n[i]!==void 0&&(o[i]=n[i]);return this.applyEnvOverrides(o)}catch(t){return console.warn("[SETTINGS] Failed to load settings, using defaults:",e,t),this.applyEnvOverrides(this.getAllDefaults())}}}});function li(){return typeof __dirname<"u"?__dirname:(0,j.dirname)((0,or.fileURLToPath)(Ei.url))}function cr(s){(0,rr.mkdirSync)(s,{recursive:!0})}function dr(){try{let s=(0,nr.execSync)("git rev-parse --show-toplevel",{cwd:process.cwd(),encoding:"utf8",stdio:["pipe","pipe","ignore"],windowsHide:!0}).trim();return(0,j.basename)((0,j.dirname)(s))+"/"+(0,j.basename)(s)}catch(s){S.debug("SYSTEM","Git root detection failed, using cwd basename",{cwd:process.cwd()},s);let e=process.cwd();return(0,j.basename)((0,j.dirname)(e))+"/"+(0,j.basename)(e)}}function ur(){return(0,j.join)(_i,"..")}var j,sr,rr,nr,or,Ei,_i,le,Fe,Ta,Sa,ba,Ra,ya,Oa,ir,ar,Na,Ia,Aa,Ca,Da,ke=K(()=>{"use strict";j=require("path"),sr=require("os"),rr=require("fs"),nr=require("child_process"),or=require("url");ct();oe();Ei={};_i=li(),le=Re.get("CLAUDE_MEM_DATA_DIR"),Fe=process.env.CLAUDE_CONFIG_DIR||(0,j.join)((0,sr.homedir)(),".claude"),Ta=(0,j.join)(Fe,"plugins","marketplaces",Re.get("CLAUDE_MEM_MARKETPLACE_VENDOR")),Sa=(0,j.join)(le,"archives"),ba=(0,j.join)(le,"logs"),Ra=(0,j.join)(le,"trash"),ya=(0,j.join)(le,"backups"),Oa=(0,j.join)(le,"modes"),ir=(0,j.join)(le,"settings.json"),ar=(0,j.join)(le,"claude-mem.db"),Na=(0,j.join)(le,"vector-db"),Ia=(0,j.join)(le,"observer-sessions"),Aa=(0,j.join)(Fe,"settings.json"),Ca=(0,j.join)(Fe,"commands"),Da=(0,j.join)(Fe,"CLAUDE.md")});function qt(s,e,t){return(0,gr.createHash)("sha256").update((s||"")+(e||"")+(t||"")).digest("hex").slice(0,16)}function Yt(s,e,t){let r=t-gi;return s.prepare("SELECT id, created_at_epoch FROM observations WHERE content_hash = ? AND created_at_epoch > ?").get(e,r)}function hr(s,e,t,r,n,o=0,i){let a=i??Date.now(),d=new Date(a).toISOString(),m=t||dr(),l=qt(e,r.title,r.narrative),g=Yt(s,l,a);if(g)return S.debug("DEDUP",`Skipped duplicate observation | contentHash=${l} | existingId=${g.id}`),{id:g.id,createdAtEpoch:g.created_at_epoch};let p=s.prepare(`
    INSERT INTO observations
    (memory_session_id, project, type, title, subtitle, facts, narrative, concepts,
     files_read, files_modified, prompt_number, discovery_tokens, content_hash, created_at, created_at_epoch)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(e,m,r.type,r.title,r.subtitle,JSON.stringify(r.facts),r.narrative,JSON.stringify(r.concepts),JSON.stringify(r.files_read),JSON.stringify(r.files_modified),n||null,o,l,d,a);return{id:Number(p.lastInsertRowid),createdAtEpoch:a}}var gr,gi,Vt=K(()=>{"use strict";gr=require("crypto");oe();ke();gi=3e4});var $r={};it($r,{SessionStore:()=>rs});var Ur,rs,Fr=K(()=>{"use strict";Ur=require("bun:sqlite");ke();oe();Vt();rs=class{db;constructor(e=ar){e!==":memory:"&&cr(le),this.db=new Ur.Database(e),this.db.run("PRAGMA journal_mode = WAL"),this.db.run("PRAGMA synchronous = NORMAL"),this.db.run("PRAGMA foreign_keys = ON"),this.initializeSchema(),this.ensureWorkerPortColumn(),this.ensurePromptTrackingColumns(),this.removeSessionSummariesUniqueConstraint(),this.addObservationHierarchicalFields(),this.makeObservationsTextNullable(),this.createUserPromptsTable(),this.ensureDiscoveryTokensColumn(),this.createPendingMessagesTable(),this.renameSessionIdColumns(),this.repairSessionIdColumnRename(),this.addFailedAtEpochColumn(),this.addOnUpdateCascadeToForeignKeys(),this.addObservationContentHashColumn(),this.addSessionCustomTitleColumn()}initializeSchema(){this.db.run(`
      CREATE TABLE IF NOT EXISTS schema_versions (
        id INTEGER PRIMARY KEY,
        version INTEGER UNIQUE NOT NULL,
        applied_at TEXT NOT NULL
      )
    `),this.db.run(`
      CREATE TABLE IF NOT EXISTS sdk_sessions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        content_session_id TEXT UNIQUE NOT NULL,
        memory_session_id TEXT UNIQUE,
        project TEXT NOT NULL,
        user_prompt TEXT,
        started_at TEXT NOT NULL,
        started_at_epoch INTEGER NOT NULL,
        completed_at TEXT,
        completed_at_epoch INTEGER,
        status TEXT CHECK(status IN ('active', 'completed', 'failed')) NOT NULL DEFAULT 'active'
      );

      CREATE INDEX IF NOT EXISTS idx_sdk_sessions_claude_id ON sdk_sessions(content_session_id);
      CREATE INDEX IF NOT EXISTS idx_sdk_sessions_sdk_id ON sdk_sessions(memory_session_id);
      CREATE INDEX IF NOT EXISTS idx_sdk_sessions_project ON sdk_sessions(project);
      CREATE INDEX IF NOT EXISTS idx_sdk_sessions_status ON sdk_sessions(status);
      CREATE INDEX IF NOT EXISTS idx_sdk_sessions_started ON sdk_sessions(started_at_epoch DESC);

      CREATE TABLE IF NOT EXISTS observations (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        memory_session_id TEXT NOT NULL,
        project TEXT NOT NULL,
        text TEXT NOT NULL,
        type TEXT NOT NULL,
        created_at TEXT NOT NULL,
        created_at_epoch INTEGER NOT NULL,
        FOREIGN KEY(memory_session_id) REFERENCES sdk_sessions(memory_session_id) ON DELETE CASCADE ON UPDATE CASCADE
      );

      CREATE INDEX IF NOT EXISTS idx_observations_sdk_session ON observations(memory_session_id);
      CREATE INDEX IF NOT EXISTS idx_observations_project ON observations(project);
      CREATE INDEX IF NOT EXISTS idx_observations_type ON observations(type);
      CREATE INDEX IF NOT EXISTS idx_observations_created ON observations(created_at_epoch DESC);

      CREATE TABLE IF NOT EXISTS session_summaries (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        memory_session_id TEXT UNIQUE NOT NULL,
        project TEXT NOT NULL,
        request TEXT,
        investigated TEXT,
        learned TEXT,
        completed TEXT,
        next_steps TEXT,
        files_read TEXT,
        files_edited TEXT,
        notes TEXT,
        created_at TEXT NOT NULL,
        created_at_epoch INTEGER NOT NULL,
        FOREIGN KEY(memory_session_id) REFERENCES sdk_sessions(memory_session_id) ON DELETE CASCADE ON UPDATE CASCADE
      );

      CREATE INDEX IF NOT EXISTS idx_session_summaries_sdk_session ON session_summaries(memory_session_id);
      CREATE INDEX IF NOT EXISTS idx_session_summaries_project ON session_summaries(project);
      CREATE INDEX IF NOT EXISTS idx_session_summaries_created ON session_summaries(created_at_epoch DESC);
    `),this.db.prepare("INSERT OR IGNORE INTO schema_versions (version, applied_at) VALUES (?, ?)").run(4,new Date().toISOString())}ensureWorkerPortColumn(){this.db.query("PRAGMA table_info(sdk_sessions)").all().some(r=>r.name==="worker_port")||(this.db.run("ALTER TABLE sdk_sessions ADD COLUMN worker_port INTEGER"),S.debug("DB","Added worker_port column to sdk_sessions table")),this.db.prepare("INSERT OR IGNORE INTO schema_versions (version, applied_at) VALUES (?, ?)").run(5,new Date().toISOString())}ensurePromptTrackingColumns(){this.db.query("PRAGMA table_info(sdk_sessions)").all().some(a=>a.name==="prompt_counter")||(this.db.run("ALTER TABLE sdk_sessions ADD COLUMN prompt_counter INTEGER DEFAULT 0"),S.debug("DB","Added prompt_counter column to sdk_sessions table")),this.db.query("PRAGMA table_info(observations)").all().some(a=>a.name==="prompt_number")||(this.db.run("ALTER TABLE observations ADD COLUMN prompt_number INTEGER"),S.debug("DB","Added prompt_number column to observations table")),this.db.query("PRAGMA table_info(session_summaries)").all().some(a=>a.name==="prompt_number")||(this.db.run("ALTER TABLE session_summaries ADD COLUMN prompt_number INTEGER"),S.debug("DB","Added prompt_number column to session_summaries table")),this.db.prepare("INSERT OR IGNORE INTO schema_versions (version, applied_at) VALUES (?, ?)").run(6,new Date().toISOString())}removeSessionSummariesUniqueConstraint(){if(!this.db.query("PRAGMA index_list(session_summaries)").all().some(r=>r.unique===1)){this.db.prepare("INSERT OR IGNORE INTO schema_versions (version, applied_at) VALUES (?, ?)").run(7,new Date().toISOString());return}S.debug("DB","Removing UNIQUE constraint from session_summaries.memory_session_id"),this.db.run("BEGIN TRANSACTION"),this.db.run("DROP TABLE IF EXISTS session_summaries_new"),this.db.run(`
      CREATE TABLE session_summaries_new (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        memory_session_id TEXT NOT NULL,
        project TEXT NOT NULL,
        request TEXT,
        investigated TEXT,
        learned TEXT,
        completed TEXT,
        next_steps TEXT,
        files_read TEXT,
        files_edited TEXT,
        notes TEXT,
        prompt_number INTEGER,
        created_at TEXT NOT NULL,
        created_at_epoch INTEGER NOT NULL,
        FOREIGN KEY(memory_session_id) REFERENCES sdk_sessions(memory_session_id) ON DELETE CASCADE
      )
    `),this.db.run(`
      INSERT INTO session_summaries_new
      SELECT id, memory_session_id, project, request, investigated, learned,
             completed, next_steps, files_read, files_edited, notes,
             prompt_number, created_at, created_at_epoch
      FROM session_summaries
    `),this.db.run("DROP TABLE session_summaries"),this.db.run("ALTER TABLE session_summaries_new RENAME TO session_summaries"),this.db.run(`
      CREATE INDEX idx_session_summaries_sdk_session ON session_summaries(memory_session_id);
      CREATE INDEX idx_session_summaries_project ON session_summaries(project);
      CREATE INDEX idx_session_summaries_created ON session_summaries(created_at_epoch DESC);
    `),this.db.run("COMMIT"),this.db.prepare("INSERT OR IGNORE INTO schema_versions (version, applied_at) VALUES (?, ?)").run(7,new Date().toISOString()),S.debug("DB","Successfully removed UNIQUE constraint from session_summaries.memory_session_id")}addObservationHierarchicalFields(){if(this.db.prepare("SELECT version FROM schema_versions WHERE version = ?").get(8))return;if(this.db.query("PRAGMA table_info(observations)").all().some(n=>n.name==="title")){this.db.prepare("INSERT OR IGNORE INTO schema_versions (version, applied_at) VALUES (?, ?)").run(8,new Date().toISOString());return}S.debug("DB","Adding hierarchical fields to observations table"),this.db.run(`
      ALTER TABLE observations ADD COLUMN title TEXT;
      ALTER TABLE observations ADD COLUMN subtitle TEXT;
      ALTER TABLE observations ADD COLUMN facts TEXT;
      ALTER TABLE observations ADD COLUMN narrative TEXT;
      ALTER TABLE observations ADD COLUMN concepts TEXT;
      ALTER TABLE observations ADD COLUMN files_read TEXT;
      ALTER TABLE observations ADD COLUMN files_modified TEXT;
    `),this.db.prepare("INSERT OR IGNORE INTO schema_versions (version, applied_at) VALUES (?, ?)").run(8,new Date().toISOString()),S.debug("DB","Successfully added hierarchical fields to observations table")}makeObservationsTextNullable(){if(this.db.prepare("SELECT version FROM schema_versions WHERE version = ?").get(9))return;let r=this.db.query("PRAGMA table_info(observations)").all().find(n=>n.name==="text");if(!r||r.notnull===0){this.db.prepare("INSERT OR IGNORE INTO schema_versions (version, applied_at) VALUES (?, ?)").run(9,new Date().toISOString());return}S.debug("DB","Making observations.text nullable"),this.db.run("BEGIN TRANSACTION"),this.db.run("DROP TABLE IF EXISTS observations_new"),this.db.run(`
      CREATE TABLE observations_new (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        memory_session_id TEXT NOT NULL,
        project TEXT NOT NULL,
        text TEXT,
        type TEXT NOT NULL,
        title TEXT,
        subtitle TEXT,
        facts TEXT,
        narrative TEXT,
        concepts TEXT,
        files_read TEXT,
        files_modified TEXT,
        prompt_number INTEGER,
        created_at TEXT NOT NULL,
        created_at_epoch INTEGER NOT NULL,
        FOREIGN KEY(memory_session_id) REFERENCES sdk_sessions(memory_session_id) ON DELETE CASCADE
      )
    `),this.db.run(`
      INSERT INTO observations_new
      SELECT id, memory_session_id, project, text, type, title, subtitle, facts,
             narrative, concepts, files_read, files_modified, prompt_number,
             created_at, created_at_epoch
      FROM observations
    `),this.db.run("DROP TABLE observations"),this.db.run("ALTER TABLE observations_new RENAME TO observations"),this.db.run(`
      CREATE INDEX idx_observations_sdk_session ON observations(memory_session_id);
      CREATE INDEX idx_observations_project ON observations(project);
      CREATE INDEX idx_observations_type ON observations(type);
      CREATE INDEX idx_observations_created ON observations(created_at_epoch DESC);
    `),this.db.run("COMMIT"),this.db.prepare("INSERT OR IGNORE INTO schema_versions (version, applied_at) VALUES (?, ?)").run(9,new Date().toISOString()),S.debug("DB","Successfully made observations.text nullable")}createUserPromptsTable(){if(this.db.prepare("SELECT version FROM schema_versions WHERE version = ?").get(10))return;if(this.db.query("PRAGMA table_info(user_prompts)").all().length>0){this.db.prepare("INSERT OR IGNORE INTO schema_versions (version, applied_at) VALUES (?, ?)").run(10,new Date().toISOString());return}S.debug("DB","Creating user_prompts table with FTS5 support"),this.db.run("BEGIN TRANSACTION"),this.db.run(`
      CREATE TABLE user_prompts (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        content_session_id TEXT NOT NULL,
        prompt_number INTEGER NOT NULL,
        prompt_text TEXT NOT NULL,
        created_at TEXT NOT NULL,
        created_at_epoch INTEGER NOT NULL,
        FOREIGN KEY(content_session_id) REFERENCES sdk_sessions(content_session_id) ON DELETE CASCADE
      );

      CREATE INDEX idx_user_prompts_claude_session ON user_prompts(content_session_id);
      CREATE INDEX idx_user_prompts_created ON user_prompts(created_at_epoch DESC);
      CREATE INDEX idx_user_prompts_prompt_number ON user_prompts(prompt_number);
      CREATE INDEX idx_user_prompts_lookup ON user_prompts(content_session_id, prompt_number);
    `);try{this.db.run(`
        CREATE VIRTUAL TABLE user_prompts_fts USING fts5(
          prompt_text,
          content='user_prompts',
          content_rowid='id'
        );
      `),this.db.run(`
        CREATE TRIGGER user_prompts_ai AFTER INSERT ON user_prompts BEGIN
          INSERT INTO user_prompts_fts(rowid, prompt_text)
          VALUES (new.id, new.prompt_text);
        END;

        CREATE TRIGGER user_prompts_ad AFTER DELETE ON user_prompts BEGIN
          INSERT INTO user_prompts_fts(user_prompts_fts, rowid, prompt_text)
          VALUES('delete', old.id, old.prompt_text);
        END;

        CREATE TRIGGER user_prompts_au AFTER UPDATE ON user_prompts BEGIN
          INSERT INTO user_prompts_fts(user_prompts_fts, rowid, prompt_text)
          VALUES('delete', old.id, old.prompt_text);
          INSERT INTO user_prompts_fts(rowid, prompt_text)
          VALUES (new.id, new.prompt_text);
        END;
      `)}catch(r){S.warn("DB","FTS5 not available \u2014 user_prompts_fts skipped (search uses ChromaDB)",{},r)}this.db.run("COMMIT"),this.db.prepare("INSERT OR IGNORE INTO schema_versions (version, applied_at) VALUES (?, ?)").run(10,new Date().toISOString()),S.debug("DB","Successfully created user_prompts table")}ensureDiscoveryTokensColumn(){if(this.db.prepare("SELECT version FROM schema_versions WHERE version = ?").get(11))return;this.db.query("PRAGMA table_info(observations)").all().some(i=>i.name==="discovery_tokens")||(this.db.run("ALTER TABLE observations ADD COLUMN discovery_tokens INTEGER DEFAULT 0"),S.debug("DB","Added discovery_tokens column to observations table")),this.db.query("PRAGMA table_info(session_summaries)").all().some(i=>i.name==="discovery_tokens")||(this.db.run("ALTER TABLE session_summaries ADD COLUMN discovery_tokens INTEGER DEFAULT 0"),S.debug("DB","Added discovery_tokens column to session_summaries table")),this.db.prepare("INSERT OR IGNORE INTO schema_versions (version, applied_at) VALUES (?, ?)").run(11,new Date().toISOString())}createPendingMessagesTable(){if(this.db.prepare("SELECT version FROM schema_versions WHERE version = ?").get(16))return;if(this.db.query("SELECT name FROM sqlite_master WHERE type='table' AND name='pending_messages'").all().length>0){this.db.prepare("INSERT OR IGNORE INTO schema_versions (version, applied_at) VALUES (?, ?)").run(16,new Date().toISOString());return}S.debug("DB","Creating pending_messages table"),this.db.run(`
      CREATE TABLE pending_messages (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        session_db_id INTEGER NOT NULL,
        content_session_id TEXT NOT NULL,
        message_type TEXT NOT NULL CHECK(message_type IN ('observation', 'summarize')),
        tool_name TEXT,
        tool_input TEXT,
        tool_response TEXT,
        cwd TEXT,
        last_user_message TEXT,
        last_assistant_message TEXT,
        prompt_number INTEGER,
        status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending', 'processing', 'processed', 'failed')),
        retry_count INTEGER NOT NULL DEFAULT 0,
        created_at_epoch INTEGER NOT NULL,
        started_processing_at_epoch INTEGER,
        completed_at_epoch INTEGER,
        FOREIGN KEY (session_db_id) REFERENCES sdk_sessions(id) ON DELETE CASCADE
      )
    `),this.db.run("CREATE INDEX IF NOT EXISTS idx_pending_messages_session ON pending_messages(session_db_id)"),this.db.run("CREATE INDEX IF NOT EXISTS idx_pending_messages_status ON pending_messages(status)"),this.db.run("CREATE INDEX IF NOT EXISTS idx_pending_messages_claude_session ON pending_messages(content_session_id)"),this.db.prepare("INSERT OR IGNORE INTO schema_versions (version, applied_at) VALUES (?, ?)").run(16,new Date().toISOString()),S.debug("DB","pending_messages table created successfully")}renameSessionIdColumns(){if(this.db.prepare("SELECT version FROM schema_versions WHERE version = ?").get(17))return;S.debug("DB","Checking session ID columns for semantic clarity rename");let t=0,r=(n,o,i)=>{let a=this.db.query(`PRAGMA table_info(${n})`).all(),d=a.some(l=>l.name===o);return a.some(l=>l.name===i)?!1:d?(this.db.run(`ALTER TABLE ${n} RENAME COLUMN ${o} TO ${i}`),S.debug("DB",`Renamed ${n}.${o} to ${i}`),!0):(S.warn("DB",`Column ${o} not found in ${n}, skipping rename`),!1)};r("sdk_sessions","claude_session_id","content_session_id")&&t++,r("sdk_sessions","sdk_session_id","memory_session_id")&&t++,r("pending_messages","claude_session_id","content_session_id")&&t++,r("observations","sdk_session_id","memory_session_id")&&t++,r("session_summaries","sdk_session_id","memory_session_id")&&t++,r("user_prompts","claude_session_id","content_session_id")&&t++,this.db.prepare("INSERT OR IGNORE INTO schema_versions (version, applied_at) VALUES (?, ?)").run(17,new Date().toISOString()),t>0?S.debug("DB",`Successfully renamed ${t} session ID columns`):S.debug("DB","No session ID column renames needed (already up to date)")}repairSessionIdColumnRename(){this.db.prepare("SELECT version FROM schema_versions WHERE version = ?").get(19)||this.db.prepare("INSERT OR IGNORE INTO schema_versions (version, applied_at) VALUES (?, ?)").run(19,new Date().toISOString())}addFailedAtEpochColumn(){if(this.db.prepare("SELECT version FROM schema_versions WHERE version = ?").get(20))return;this.db.query("PRAGMA table_info(pending_messages)").all().some(n=>n.name==="failed_at_epoch")||(this.db.run("ALTER TABLE pending_messages ADD COLUMN failed_at_epoch INTEGER"),S.debug("DB","Added failed_at_epoch column to pending_messages table")),this.db.prepare("INSERT OR IGNORE INTO schema_versions (version, applied_at) VALUES (?, ?)").run(20,new Date().toISOString())}addOnUpdateCascadeToForeignKeys(){if(!this.db.prepare("SELECT version FROM schema_versions WHERE version = ?").get(21)){S.debug("DB","Adding ON UPDATE CASCADE to FK constraints on observations and session_summaries"),this.db.run("PRAGMA foreign_keys = OFF"),this.db.run("BEGIN TRANSACTION");try{this.db.run("DROP TRIGGER IF EXISTS observations_ai"),this.db.run("DROP TRIGGER IF EXISTS observations_ad"),this.db.run("DROP TRIGGER IF EXISTS observations_au"),this.db.run("DROP TABLE IF EXISTS observations_new"),this.db.run(`
        CREATE TABLE observations_new (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          memory_session_id TEXT NOT NULL,
          project TEXT NOT NULL,
          text TEXT,
          type TEXT NOT NULL,
          title TEXT,
          subtitle TEXT,
          facts TEXT,
          narrative TEXT,
          concepts TEXT,
          files_read TEXT,
          files_modified TEXT,
          prompt_number INTEGER,
          discovery_tokens INTEGER DEFAULT 0,
          created_at TEXT NOT NULL,
          created_at_epoch INTEGER NOT NULL,
          FOREIGN KEY(memory_session_id) REFERENCES sdk_sessions(memory_session_id) ON DELETE CASCADE ON UPDATE CASCADE
        )
      `),this.db.run(`
        INSERT INTO observations_new
        SELECT id, memory_session_id, project, text, type, title, subtitle, facts,
               narrative, concepts, files_read, files_modified, prompt_number,
               discovery_tokens, created_at, created_at_epoch
        FROM observations
      `),this.db.run("DROP TABLE observations"),this.db.run("ALTER TABLE observations_new RENAME TO observations"),this.db.run(`
        CREATE INDEX idx_observations_sdk_session ON observations(memory_session_id);
        CREATE INDEX idx_observations_project ON observations(project);
        CREATE INDEX idx_observations_type ON observations(type);
        CREATE INDEX idx_observations_created ON observations(created_at_epoch DESC);
      `),this.db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='observations_fts'").all().length>0&&this.db.run(`
          CREATE TRIGGER IF NOT EXISTS observations_ai AFTER INSERT ON observations BEGIN
            INSERT INTO observations_fts(rowid, title, subtitle, narrative, text, facts, concepts)
            VALUES (new.id, new.title, new.subtitle, new.narrative, new.text, new.facts, new.concepts);
          END;

          CREATE TRIGGER IF NOT EXISTS observations_ad AFTER DELETE ON observations BEGIN
            INSERT INTO observations_fts(observations_fts, rowid, title, subtitle, narrative, text, facts, concepts)
            VALUES('delete', old.id, old.title, old.subtitle, old.narrative, old.text, old.facts, old.concepts);
          END;

          CREATE TRIGGER IF NOT EXISTS observations_au AFTER UPDATE ON observations BEGIN
            INSERT INTO observations_fts(observations_fts, rowid, title, subtitle, narrative, text, facts, concepts)
            VALUES('delete', old.id, old.title, old.subtitle, old.narrative, old.text, old.facts, old.concepts);
            INSERT INTO observations_fts(rowid, title, subtitle, narrative, text, facts, concepts)
            VALUES (new.id, new.title, new.subtitle, new.narrative, new.text, new.facts, new.concepts);
          END;
        `),this.db.run("DROP TABLE IF EXISTS session_summaries_new"),this.db.run(`
        CREATE TABLE session_summaries_new (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          memory_session_id TEXT NOT NULL,
          project TEXT NOT NULL,
          request TEXT,
          investigated TEXT,
          learned TEXT,
          completed TEXT,
          next_steps TEXT,
          files_read TEXT,
          files_edited TEXT,
          notes TEXT,
          prompt_number INTEGER,
          discovery_tokens INTEGER DEFAULT 0,
          created_at TEXT NOT NULL,
          created_at_epoch INTEGER NOT NULL,
          FOREIGN KEY(memory_session_id) REFERENCES sdk_sessions(memory_session_id) ON DELETE CASCADE ON UPDATE CASCADE
        )
      `),this.db.run(`
        INSERT INTO session_summaries_new
        SELECT id, memory_session_id, project, request, investigated, learned,
               completed, next_steps, files_read, files_edited, notes,
               prompt_number, discovery_tokens, created_at, created_at_epoch
        FROM session_summaries
      `),this.db.run("DROP TRIGGER IF EXISTS session_summaries_ai"),this.db.run("DROP TRIGGER IF EXISTS session_summaries_ad"),this.db.run("DROP TRIGGER IF EXISTS session_summaries_au"),this.db.run("DROP TABLE session_summaries"),this.db.run("ALTER TABLE session_summaries_new RENAME TO session_summaries"),this.db.run(`
        CREATE INDEX idx_session_summaries_sdk_session ON session_summaries(memory_session_id);
        CREATE INDEX idx_session_summaries_project ON session_summaries(project);
        CREATE INDEX idx_session_summaries_created ON session_summaries(created_at_epoch DESC);
      `),this.db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='session_summaries_fts'").all().length>0&&this.db.run(`
          CREATE TRIGGER IF NOT EXISTS session_summaries_ai AFTER INSERT ON session_summaries BEGIN
            INSERT INTO session_summaries_fts(rowid, request, investigated, learned, completed, next_steps, notes)
            VALUES (new.id, new.request, new.investigated, new.learned, new.completed, new.next_steps, new.notes);
          END;

          CREATE TRIGGER IF NOT EXISTS session_summaries_ad AFTER DELETE ON session_summaries BEGIN
            INSERT INTO session_summaries_fts(session_summaries_fts, rowid, request, investigated, learned, completed, next_steps, notes)
            VALUES('delete', old.id, old.request, old.investigated, old.learned, old.completed, old.next_steps, old.notes);
          END;

          CREATE TRIGGER IF NOT EXISTS session_summaries_au AFTER UPDATE ON session_summaries BEGIN
            INSERT INTO session_summaries_fts(session_summaries_fts, rowid, request, investigated, learned, completed, next_steps, notes)
            VALUES('delete', old.id, old.request, old.investigated, old.learned, old.completed, old.next_steps, old.notes);
            INSERT INTO session_summaries_fts(rowid, request, investigated, learned, completed, next_steps, notes)
            VALUES (new.id, new.request, new.investigated, new.learned, new.completed, new.next_steps, new.notes);
          END;
        `),this.db.prepare("INSERT OR IGNORE INTO schema_versions (version, applied_at) VALUES (?, ?)").run(21,new Date().toISOString()),this.db.run("COMMIT"),this.db.run("PRAGMA foreign_keys = ON"),S.debug("DB","Successfully added ON UPDATE CASCADE to FK constraints")}catch(t){throw this.db.run("ROLLBACK"),this.db.run("PRAGMA foreign_keys = ON"),t}}}addObservationContentHashColumn(){if(this.db.prepare("SELECT version FROM schema_versions WHERE version = ?").get(22))return;this.db.query("PRAGMA table_info(observations)").all().some(n=>n.name==="content_hash")||(this.db.run("ALTER TABLE observations ADD COLUMN content_hash TEXT"),this.db.run("UPDATE observations SET content_hash = substr(hex(randomblob(8)), 1, 16) WHERE content_hash IS NULL"),this.db.run("CREATE INDEX IF NOT EXISTS idx_observations_content_hash ON observations(content_hash, created_at_epoch)"),S.debug("DB","Added content_hash column to observations table with backfill and index")),this.db.prepare("INSERT OR IGNORE INTO schema_versions (version, applied_at) VALUES (?, ?)").run(22,new Date().toISOString())}addSessionCustomTitleColumn(){if(this.db.prepare("SELECT version FROM schema_versions WHERE version = ?").get(23))return;this.db.query("PRAGMA table_info(sdk_sessions)").all().some(n=>n.name==="custom_title")||(this.db.run("ALTER TABLE sdk_sessions ADD COLUMN custom_title TEXT"),S.debug("DB","Added custom_title column to sdk_sessions table")),this.db.prepare("INSERT OR IGNORE INTO schema_versions (version, applied_at) VALUES (?, ?)").run(23,new Date().toISOString())}updateMemorySessionId(e,t){this.db.prepare(`
      UPDATE sdk_sessions
      SET memory_session_id = ?
      WHERE id = ?
    `).run(t,e)}ensureMemorySessionIdRegistered(e,t){let r=this.db.prepare(`
      SELECT id, memory_session_id FROM sdk_sessions WHERE id = ?
    `).get(e);if(!r)throw new Error(`Session ${e} not found in sdk_sessions`);r.memory_session_id!==t&&(this.db.prepare(`
        UPDATE sdk_sessions SET memory_session_id = ? WHERE id = ?
      `).run(t,e),S.info("DB","Registered memory_session_id before storage (FK fix)",{sessionDbId:e,oldId:r.memory_session_id,newId:t}))}getRecentSummaries(e,t=10){return this.db.prepare(`
      SELECT
        request, investigated, learned, completed, next_steps,
        files_read, files_edited, notes, prompt_number, created_at
      FROM session_summaries
      WHERE project = ?
      ORDER BY created_at_epoch DESC
      LIMIT ?
    `).all(e,t)}getRecentSummariesWithSessionInfo(e,t=3){return this.db.prepare(`
      SELECT
        memory_session_id, request, learned, completed, next_steps,
        prompt_number, created_at
      FROM session_summaries
      WHERE project = ?
      ORDER BY created_at_epoch DESC
      LIMIT ?
    `).all(e,t)}getRecentObservations(e,t=20){return this.db.prepare(`
      SELECT type, text, prompt_number, created_at
      FROM observations
      WHERE project = ?
      ORDER BY created_at_epoch DESC
      LIMIT ?
    `).all(e,t)}getAllRecentObservations(e=100){return this.db.prepare(`
      SELECT id, type, title, subtitle, text, project, prompt_number, created_at, created_at_epoch
      FROM observations
      ORDER BY created_at_epoch DESC
      LIMIT ?
    `).all(e)}getAllRecentSummaries(e=50){return this.db.prepare(`
      SELECT id, request, investigated, learned, completed, next_steps,
             files_read, files_edited, notes, project, prompt_number,
             created_at, created_at_epoch
      FROM session_summaries
      ORDER BY created_at_epoch DESC
      LIMIT ?
    `).all(e)}getAllRecentUserPrompts(e=100){return this.db.prepare(`
      SELECT
        up.id,
        up.content_session_id,
        s.project,
        up.prompt_number,
        up.prompt_text,
        up.created_at,
        up.created_at_epoch
      FROM user_prompts up
      LEFT JOIN sdk_sessions s ON up.content_session_id = s.content_session_id
      ORDER BY up.created_at_epoch DESC
      LIMIT ?
    `).all(e)}getAllProjects(){return this.db.prepare(`
      SELECT DISTINCT project
      FROM sdk_sessions
      WHERE project IS NOT NULL AND project != ''
      ORDER BY project ASC
    `).all().map(r=>r.project)}getLatestUserPrompt(e){return this.db.prepare(`
      SELECT
        up.*,
        s.memory_session_id,
        s.project
      FROM user_prompts up
      JOIN sdk_sessions s ON up.content_session_id = s.content_session_id
      WHERE up.content_session_id = ?
      ORDER BY up.created_at_epoch DESC
      LIMIT 1
    `).get(e)}getRecentSessionsWithStatus(e,t=3){return this.db.prepare(`
      SELECT * FROM (
        SELECT
          s.memory_session_id,
          s.status,
          s.started_at,
          s.started_at_epoch,
          s.user_prompt,
          CASE WHEN sum.memory_session_id IS NOT NULL THEN 1 ELSE 0 END as has_summary
        FROM sdk_sessions s
        LEFT JOIN session_summaries sum ON s.memory_session_id = sum.memory_session_id
        WHERE s.project = ? AND s.memory_session_id IS NOT NULL
        GROUP BY s.memory_session_id
        ORDER BY s.started_at_epoch DESC
        LIMIT ?
      )
      ORDER BY started_at_epoch ASC
    `).all(e,t)}getObservationsForSession(e){return this.db.prepare(`
      SELECT title, subtitle, type, prompt_number
      FROM observations
      WHERE memory_session_id = ?
      ORDER BY created_at_epoch ASC
    `).all(e)}getObservationById(e){return this.db.prepare(`
      SELECT *
      FROM observations
      WHERE id = ?
    `).get(e)||null}getObservationsByIds(e,t={}){if(e.length===0)return[];let{orderBy:r="date_desc",limit:n,project:o,type:i,concepts:a,files:d}=t,m=r==="date_asc"?"ASC":"DESC",l=n?`LIMIT ${n}`:"",g=e.map(()=>"?").join(","),h=[...e],p=[];if(o&&(p.push("project = ?"),h.push(o)),i)if(Array.isArray(i)){let f=i.map(()=>"?").join(",");p.push(`type IN (${f})`),h.push(...i)}else p.push("type = ?"),h.push(i);if(a){let f=Array.isArray(a)?a:[a],O=f.map(()=>"EXISTS (SELECT 1 FROM json_each(concepts) WHERE value = ?)");h.push(...f),p.push(`(${O.join(" OR ")})`)}if(d){let f=Array.isArray(d)?d:[d],O=f.map(()=>"(EXISTS (SELECT 1 FROM json_each(files_read) WHERE value LIKE ?) OR EXISTS (SELECT 1 FROM json_each(files_modified) WHERE value LIKE ?))");f.forEach(A=>{h.push(`%${A}%`,`%${A}%`)}),p.push(`(${O.join(" OR ")})`)}let y=p.length>0?`WHERE id IN (${g}) AND ${p.join(" AND ")}`:`WHERE id IN (${g})`;return this.db.prepare(`
      SELECT *
      FROM observations
      ${y}
      ORDER BY created_at_epoch ${m}
      ${l}
    `).all(...h)}getSummaryForSession(e){return this.db.prepare(`
      SELECT
        request, investigated, learned, completed, next_steps,
        files_read, files_edited, notes, prompt_number, created_at,
        created_at_epoch
      FROM session_summaries
      WHERE memory_session_id = ?
      ORDER BY created_at_epoch DESC
      LIMIT 1
    `).get(e)||null}getFilesForSession(e){let r=this.db.prepare(`
      SELECT files_read, files_modified
      FROM observations
      WHERE memory_session_id = ?
    `).all(e),n=new Set,o=new Set;for(let i of r){if(i.files_read){let a=JSON.parse(i.files_read);Array.isArray(a)&&a.forEach(d=>n.add(d))}if(i.files_modified){let a=JSON.parse(i.files_modified);Array.isArray(a)&&a.forEach(d=>o.add(d))}}return{filesRead:Array.from(n),filesModified:Array.from(o)}}getSessionById(e){return this.db.prepare(`
      SELECT id, content_session_id, memory_session_id, project, user_prompt, custom_title
      FROM sdk_sessions
      WHERE id = ?
      LIMIT 1
    `).get(e)||null}getSdkSessionsBySessionIds(e){if(e.length===0)return[];let t=e.map(()=>"?").join(",");return this.db.prepare(`
      SELECT id, content_session_id, memory_session_id, project, user_prompt, custom_title,
             started_at, started_at_epoch, completed_at, completed_at_epoch, status
      FROM sdk_sessions
      WHERE memory_session_id IN (${t})
      ORDER BY started_at_epoch DESC
    `).all(...e)}getPromptNumberFromUserPrompts(e){return this.db.prepare(`
      SELECT COUNT(*) as count FROM user_prompts WHERE content_session_id = ?
    `).get(e).count}createSDKSession(e,t,r,n){let o=new Date,i=o.getTime(),a=this.db.prepare(`
      SELECT id FROM sdk_sessions WHERE content_session_id = ?
    `).get(e);return a?(t&&this.db.prepare(`
          UPDATE sdk_sessions SET project = ?
          WHERE content_session_id = ? AND (project IS NULL OR project = '')
        `).run(t,e),n&&this.db.prepare(`
          UPDATE sdk_sessions SET custom_title = ?
          WHERE content_session_id = ? AND custom_title IS NULL
        `).run(n,e),a.id):(this.db.prepare(`
      INSERT INTO sdk_sessions
      (content_session_id, memory_session_id, project, user_prompt, custom_title, started_at, started_at_epoch, status)
      VALUES (?, NULL, ?, ?, ?, ?, ?, 'active')
    `).run(e,t,r,n||null,o.toISOString(),i),this.db.prepare("SELECT id FROM sdk_sessions WHERE content_session_id = ?").get(e).id)}saveUserPrompt(e,t,r){let n=new Date,o=n.getTime();return this.db.prepare(`
      INSERT INTO user_prompts
      (content_session_id, prompt_number, prompt_text, created_at, created_at_epoch)
      VALUES (?, ?, ?, ?, ?)
    `).run(e,t,r,n.toISOString(),o).lastInsertRowid}getUserPrompt(e,t){return this.db.prepare(`
      SELECT prompt_text
      FROM user_prompts
      WHERE content_session_id = ? AND prompt_number = ?
      LIMIT 1
    `).get(e,t)?.prompt_text??null}storeObservation(e,t,r,n,o=0,i){let a=i??Date.now(),d=new Date(a).toISOString(),m=qt(e,r.title,r.narrative),l=Yt(this.db,m,a);if(l)return{id:l.id,createdAtEpoch:l.created_at_epoch};let h=this.db.prepare(`
      INSERT INTO observations
      (memory_session_id, project, type, title, subtitle, facts, narrative, concepts,
       files_read, files_modified, prompt_number, discovery_tokens, content_hash, created_at, created_at_epoch)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(e,t,r.type,r.title,r.subtitle,JSON.stringify(r.facts),r.narrative,JSON.stringify(r.concepts),JSON.stringify(r.files_read),JSON.stringify(r.files_modified),n||null,o,m,d,a);return{id:Number(h.lastInsertRowid),createdAtEpoch:a}}storeSummary(e,t,r,n,o=0,i){let a=i??Date.now(),d=new Date(a).toISOString(),l=this.db.prepare(`
      INSERT INTO session_summaries
      (memory_session_id, project, request, investigated, learned, completed,
       next_steps, notes, prompt_number, discovery_tokens, created_at, created_at_epoch)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(e,t,r.request,r.investigated,r.learned,r.completed,r.next_steps,r.notes,n||null,o,d,a);return{id:Number(l.lastInsertRowid),createdAtEpoch:a}}storeObservations(e,t,r,n,o,i=0,a){let d=a??Date.now(),m=new Date(d).toISOString();return this.db.transaction(()=>{let g=[],h=this.db.prepare(`
        INSERT INTO observations
        (memory_session_id, project, type, title, subtitle, facts, narrative, concepts,
         files_read, files_modified, prompt_number, discovery_tokens, created_at, created_at_epoch)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);for(let y of r){let _=h.run(e,t,y.type,y.title,y.subtitle,JSON.stringify(y.facts),y.narrative,JSON.stringify(y.concepts),JSON.stringify(y.files_read),JSON.stringify(y.files_modified),o||null,i,m,d);g.push(Number(_.lastInsertRowid))}let p=null;if(n){let _=this.db.prepare(`
          INSERT INTO session_summaries
          (memory_session_id, project, request, investigated, learned, completed,
           next_steps, notes, prompt_number, discovery_tokens, created_at, created_at_epoch)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `).run(e,t,n.request,n.investigated,n.learned,n.completed,n.next_steps,n.notes,o||null,i,m,d);p=Number(_.lastInsertRowid)}return{observationIds:g,summaryId:p,createdAtEpoch:d}})()}storeObservationsAndMarkComplete(e,t,r,n,o,i,a,d=0,m){let l=m??Date.now(),g=new Date(l).toISOString();return this.db.transaction(()=>{let p=[],y=this.db.prepare(`
        INSERT INTO observations
        (memory_session_id, project, type, title, subtitle, facts, narrative, concepts,
         files_read, files_modified, prompt_number, discovery_tokens, created_at, created_at_epoch)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);for(let O of r){let A=y.run(e,t,O.type,O.title,O.subtitle,JSON.stringify(O.facts),O.narrative,JSON.stringify(O.concepts),JSON.stringify(O.files_read),JSON.stringify(O.files_modified),a||null,d,g,l);p.push(Number(A.lastInsertRowid))}let _;if(n){let A=this.db.prepare(`
          INSERT INTO session_summaries
          (memory_session_id, project, request, investigated, learned, completed,
           next_steps, notes, prompt_number, discovery_tokens, created_at, created_at_epoch)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `).run(e,t,n.request,n.investigated,n.learned,n.completed,n.next_steps,n.notes,a||null,d,g,l);_=Number(A.lastInsertRowid)}return this.db.prepare(`
        UPDATE pending_messages
        SET
          status = 'processed',
          completed_at_epoch = ?,
          tool_input = NULL,
          tool_response = NULL
        WHERE id = ? AND status = 'processing'
      `).run(l,o),{observationIds:p,summaryId:_,createdAtEpoch:l}})()}getSessionSummariesByIds(e,t={}){if(e.length===0)return[];let{orderBy:r="date_desc",limit:n,project:o}=t,i=r==="date_asc"?"ASC":"DESC",a=n?`LIMIT ${n}`:"",d=e.map(()=>"?").join(","),m=[...e],l=o?`WHERE id IN (${d}) AND project = ?`:`WHERE id IN (${d})`;return o&&m.push(o),this.db.prepare(`
      SELECT * FROM session_summaries
      ${l}
      ORDER BY created_at_epoch ${i}
      ${a}
    `).all(...m)}getUserPromptsByIds(e,t={}){if(e.length===0)return[];let{orderBy:r="date_desc",limit:n,project:o}=t,i=r==="date_asc"?"ASC":"DESC",a=n?`LIMIT ${n}`:"",d=e.map(()=>"?").join(","),m=[...e],l=o?"AND s.project = ?":"";return o&&m.push(o),this.db.prepare(`
      SELECT
        up.*,
        s.project,
        s.memory_session_id
      FROM user_prompts up
      JOIN sdk_sessions s ON up.content_session_id = s.content_session_id
      WHERE up.id IN (${d}) ${l}
      ORDER BY up.created_at_epoch ${i}
      ${a}
    `).all(...m)}getTimelineAroundTimestamp(e,t=10,r=10,n){return this.getTimelineAroundObservation(null,e,t,r,n)}getTimelineAroundObservation(e,t,r=10,n=10,o){let i=o?"AND project = ?":"",a=o?[o]:[],d,m;if(e!==null){let f=`
        SELECT id, created_at_epoch
        FROM observations
        WHERE id <= ? ${i}
        ORDER BY id DESC
        LIMIT ?
      `,O=`
        SELECT id, created_at_epoch
        FROM observations
        WHERE id >= ? ${i}
        ORDER BY id ASC
        LIMIT ?
      `;try{let A=this.db.prepare(f).all(e,...a,r+1),v=this.db.prepare(O).all(e,...a,n+1);if(A.length===0&&v.length===0)return{observations:[],sessions:[],prompts:[]};d=A.length>0?A[A.length-1].created_at_epoch:t,m=v.length>0?v[v.length-1].created_at_epoch:t}catch(A){return S.error("DB","Error getting boundary observations",void 0,{error:A,project:o}),{observations:[],sessions:[],prompts:[]}}}else{let f=`
        SELECT created_at_epoch
        FROM observations
        WHERE created_at_epoch <= ? ${i}
        ORDER BY created_at_epoch DESC
        LIMIT ?
      `,O=`
        SELECT created_at_epoch
        FROM observations
        WHERE created_at_epoch >= ? ${i}
        ORDER BY created_at_epoch ASC
        LIMIT ?
      `;try{let A=this.db.prepare(f).all(t,...a,r),v=this.db.prepare(O).all(t,...a,n+1);if(A.length===0&&v.length===0)return{observations:[],sessions:[],prompts:[]};d=A.length>0?A[A.length-1].created_at_epoch:t,m=v.length>0?v[v.length-1].created_at_epoch:t}catch(A){return S.error("DB","Error getting boundary timestamps",void 0,{error:A,project:o}),{observations:[],sessions:[],prompts:[]}}}let l=`
      SELECT *
      FROM observations
      WHERE created_at_epoch >= ? AND created_at_epoch <= ? ${i}
      ORDER BY created_at_epoch ASC
    `,g=`
      SELECT *
      FROM session_summaries
      WHERE created_at_epoch >= ? AND created_at_epoch <= ? ${i}
      ORDER BY created_at_epoch ASC
    `,h=`
      SELECT up.*, s.project, s.memory_session_id
      FROM user_prompts up
      JOIN sdk_sessions s ON up.content_session_id = s.content_session_id
      WHERE up.created_at_epoch >= ? AND up.created_at_epoch <= ? ${i.replace("project","s.project")}
      ORDER BY up.created_at_epoch ASC
    `,p=this.db.prepare(l).all(d,m,...a),y=this.db.prepare(g).all(d,m,...a),_=this.db.prepare(h).all(d,m,...a);return{observations:p,sessions:y.map(f=>({id:f.id,memory_session_id:f.memory_session_id,project:f.project,request:f.request,completed:f.completed,next_steps:f.next_steps,created_at:f.created_at,created_at_epoch:f.created_at_epoch})),prompts:_.map(f=>({id:f.id,content_session_id:f.content_session_id,prompt_number:f.prompt_number,prompt_text:f.prompt_text,project:f.project,created_at:f.created_at,created_at_epoch:f.created_at_epoch}))}}getPromptById(e){return this.db.prepare(`
      SELECT
        p.id,
        p.content_session_id,
        p.prompt_number,
        p.prompt_text,
        s.project,
        p.created_at,
        p.created_at_epoch
      FROM user_prompts p
      LEFT JOIN sdk_sessions s ON p.content_session_id = s.content_session_id
      WHERE p.id = ?
      LIMIT 1
    `).get(e)||null}getPromptsByIds(e){if(e.length===0)return[];let t=e.map(()=>"?").join(",");return this.db.prepare(`
      SELECT
        p.id,
        p.content_session_id,
        p.prompt_number,
        p.prompt_text,
        s.project,
        p.created_at,
        p.created_at_epoch
      FROM user_prompts p
      LEFT JOIN sdk_sessions s ON p.content_session_id = s.content_session_id
      WHERE p.id IN (${t})
      ORDER BY p.created_at_epoch DESC
    `).all(...e)}getSessionSummaryById(e){return this.db.prepare(`
      SELECT
        id,
        memory_session_id,
        content_session_id,
        project,
        user_prompt,
        request_summary,
        learned_summary,
        status,
        created_at,
        created_at_epoch
      FROM sdk_sessions
      WHERE id = ?
      LIMIT 1
    `).get(e)||null}getOrCreateManualSession(e){let t=`manual-${e}`,r=`manual-content-${e}`;if(this.db.prepare("SELECT memory_session_id FROM sdk_sessions WHERE memory_session_id = ?").get(t))return t;let o=new Date;return this.db.prepare(`
      INSERT INTO sdk_sessions (memory_session_id, content_session_id, project, started_at, started_at_epoch, status)
      VALUES (?, ?, ?, ?, ?, 'active')
    `).run(t,r,e,o.toISOString(),o.getTime()),S.info("SESSION","Created manual session",{memorySessionId:t,project:e}),t}close(){this.db.close()}importSdkSession(e){let t=this.db.prepare("SELECT id FROM sdk_sessions WHERE content_session_id = ?").get(e.content_session_id);return t?{imported:!1,id:t.id}:{imported:!0,id:this.db.prepare(`
      INSERT INTO sdk_sessions (
        content_session_id, memory_session_id, project, user_prompt,
        started_at, started_at_epoch, completed_at, completed_at_epoch, status
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(e.content_session_id,e.memory_session_id,e.project,e.user_prompt,e.started_at,e.started_at_epoch,e.completed_at,e.completed_at_epoch,e.status).lastInsertRowid}}importSessionSummary(e){let t=this.db.prepare("SELECT id FROM session_summaries WHERE memory_session_id = ?").get(e.memory_session_id);return t?{imported:!1,id:t.id}:{imported:!0,id:this.db.prepare(`
      INSERT INTO session_summaries (
        memory_session_id, project, request, investigated, learned,
        completed, next_steps, files_read, files_edited, notes,
        prompt_number, discovery_tokens, created_at, created_at_epoch
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(e.memory_session_id,e.project,e.request,e.investigated,e.learned,e.completed,e.next_steps,e.files_read,e.files_edited,e.notes,e.prompt_number,e.discovery_tokens||0,e.created_at,e.created_at_epoch).lastInsertRowid}}importObservation(e){let t=this.db.prepare(`
      SELECT id FROM observations
      WHERE memory_session_id = ? AND title = ? AND created_at_epoch = ?
    `).get(e.memory_session_id,e.title,e.created_at_epoch);return t?{imported:!1,id:t.id}:{imported:!0,id:this.db.prepare(`
      INSERT INTO observations (
        memory_session_id, project, text, type, title, subtitle,
        facts, narrative, concepts, files_read, files_modified,
        prompt_number, discovery_tokens, created_at, created_at_epoch
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(e.memory_session_id,e.project,e.text,e.type,e.title,e.subtitle,e.facts,e.narrative,e.concepts,e.files_read,e.files_modified,e.prompt_number,e.discovery_tokens||0,e.created_at,e.created_at_epoch).lastInsertRowid}}importUserPrompt(e){let t=this.db.prepare(`
      SELECT id FROM user_prompts
      WHERE content_session_id = ? AND prompt_number = ?
    `).get(e.content_session_id,e.prompt_number);return t?{imported:!1,id:t.id}:{imported:!0,id:this.db.prepare(`
      INSERT INTO user_prompts (
        content_session_id, prompt_number, prompt_text,
        created_at, created_at_epoch
      ) VALUES (?, ?, ?, ?, ?)
    `).run(e.content_session_id,e.prompt_number,e.prompt_text,e.created_at,e.created_at_epoch).lastInsertRowid}}}});var pt,kr=K(()=>{"use strict";oe();pt=class{constructor(e){this.sql=e}async runAllMigrations(){await this.sql`
      CREATE TABLE IF NOT EXISTS schema_versions (
        id SERIAL PRIMARY KEY,
        version INTEGER UNIQUE NOT NULL,
        applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `,await this.runMigration(1,()=>this.migrationV1_CoreTables()),await this.runMigration(2,()=>this.migrationV2_Indexes()),await this.runMigration(3,()=>this.migrationV3_TsvectorTriggers()),await this.runMigration(4,()=>this.migrationV4_RLSPolicies()),await this.runMigration(5,()=>this.migrationV5_JapaneseFTS()),S.info("DB","PostgreSQL migrations complete")}async runMigration(e,t){let[r]=await this.sql`
      SELECT version FROM schema_versions WHERE version = ${e}
    `;r||(S.info("DB",`Running PostgreSQL migration v${e}`),await this.sql.begin(async n=>{let o=this.sql;this.sql=n;try{await t(),await n`
          INSERT INTO schema_versions (version) VALUES (${e})
        `}finally{this.sql=o}}),S.info("DB",`PostgreSQL migration v${e} applied`))}async migrationV1_CoreTables(){await this.sql`CREATE EXTENSION IF NOT EXISTS vector`,await this.sql`
      CREATE TABLE IF NOT EXISTS sdk_sessions (
        id SERIAL PRIMARY KEY,
        content_session_id TEXT UNIQUE NOT NULL,
        memory_session_id TEXT UNIQUE,
        project TEXT NOT NULL,
        user_prompt TEXT,
        custom_title TEXT,
        status TEXT NOT NULL DEFAULT 'active'
          CHECK (status IN ('active', 'completed', 'failed')),
        cwd TEXT,
        hostname TEXT,
        mode TEXT,
        worker_port INTEGER,
        prompt_counter INTEGER DEFAULT 0,
        started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        started_at_epoch BIGINT NOT NULL,
        completed_at TIMESTAMPTZ,
        completed_at_epoch BIGINT
      )
    `,await this.sql`
      CREATE TABLE IF NOT EXISTS observations (
        id SERIAL PRIMARY KEY,
        memory_session_id TEXT NOT NULL
          REFERENCES sdk_sessions(memory_session_id) ON DELETE CASCADE ON UPDATE CASCADE,
        project TEXT NOT NULL,
        text TEXT,
        type TEXT NOT NULL,
        title TEXT,
        subtitle TEXT,
        facts TEXT,
        narrative TEXT,
        concepts TEXT,
        files_read TEXT,
        files_modified TEXT,
        prompt_number INTEGER,
        discovery_tokens INTEGER DEFAULT 0,
        content_hash TEXT,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        created_at_epoch BIGINT NOT NULL,
        embedding vector(384),
        search_vector tsvector
      )
    `,await this.sql`
      CREATE TABLE IF NOT EXISTS session_summaries (
        id SERIAL PRIMARY KEY,
        memory_session_id TEXT NOT NULL
          REFERENCES sdk_sessions(memory_session_id) ON DELETE CASCADE ON UPDATE CASCADE,
        project TEXT NOT NULL,
        request TEXT,
        investigated TEXT,
        learned TEXT,
        completed TEXT,
        next_steps TEXT,
        files_read TEXT,
        files_edited TEXT,
        notes TEXT,
        prompt_number INTEGER,
        discovery_tokens INTEGER DEFAULT 0,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        created_at_epoch BIGINT NOT NULL,
        embedding vector(384),
        search_vector tsvector
      )
    `,await this.sql`
      CREATE TABLE IF NOT EXISTS user_prompts (
        id SERIAL PRIMARY KEY,
        content_session_id TEXT NOT NULL
          REFERENCES sdk_sessions(content_session_id) ON DELETE CASCADE,
        prompt_number INTEGER NOT NULL,
        prompt_text TEXT NOT NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        created_at_epoch BIGINT NOT NULL,
        embedding vector(384),
        search_vector tsvector
      )
    `,await this.sql`
      CREATE TABLE IF NOT EXISTS pending_messages (
        id SERIAL PRIMARY KEY,
        session_db_id INTEGER NOT NULL
          REFERENCES sdk_sessions(id) ON DELETE CASCADE,
        content_session_id TEXT NOT NULL,
        message_type TEXT NOT NULL
          CHECK (message_type IN ('observation', 'summarize')),
        tool_name TEXT,
        tool_input TEXT,
        tool_response TEXT,
        cwd TEXT,
        last_user_message TEXT,
        last_assistant_message TEXT,
        prompt_number INTEGER,
        status TEXT NOT NULL DEFAULT 'pending'
          CHECK (status IN ('pending', 'processing', 'processed', 'failed')),
        retry_count INTEGER NOT NULL DEFAULT 0,
        created_at_epoch BIGINT NOT NULL,
        started_processing_at_epoch BIGINT,
        completed_at_epoch BIGINT,
        failed_at_epoch BIGINT
      )
    `}async migrationV2_Indexes(){await this.sql`CREATE INDEX IF NOT EXISTS idx_sdk_sessions_content_id ON sdk_sessions(content_session_id)`,await this.sql`CREATE INDEX IF NOT EXISTS idx_sdk_sessions_memory_id ON sdk_sessions(memory_session_id)`,await this.sql`CREATE INDEX IF NOT EXISTS idx_sdk_sessions_project ON sdk_sessions(project)`,await this.sql`CREATE INDEX IF NOT EXISTS idx_sdk_sessions_status ON sdk_sessions(status)`,await this.sql`CREATE INDEX IF NOT EXISTS idx_sdk_sessions_started ON sdk_sessions(started_at_epoch DESC)`,await this.sql`CREATE INDEX IF NOT EXISTS idx_sdk_sessions_project_started ON sdk_sessions(project, started_at_epoch DESC)`,await this.sql`CREATE INDEX IF NOT EXISTS idx_observations_memory_session ON observations(memory_session_id)`,await this.sql`CREATE INDEX IF NOT EXISTS idx_observations_project ON observations(project)`,await this.sql`CREATE INDEX IF NOT EXISTS idx_observations_type ON observations(type)`,await this.sql`CREATE INDEX IF NOT EXISTS idx_observations_created ON observations(created_at_epoch DESC)`,await this.sql`CREATE INDEX IF NOT EXISTS idx_observations_project_created ON observations(project, created_at_epoch DESC)`,await this.sql`CREATE INDEX IF NOT EXISTS idx_observations_content_hash ON observations(content_hash, created_at_epoch)`,await this.sql`CREATE INDEX IF NOT EXISTS idx_observations_embedding ON observations USING hnsw (embedding vector_cosine_ops)`,await this.sql`CREATE INDEX IF NOT EXISTS idx_observations_search_vector ON observations USING gin (search_vector)`,await this.sql`CREATE INDEX IF NOT EXISTS idx_summaries_memory_session ON session_summaries(memory_session_id)`,await this.sql`CREATE INDEX IF NOT EXISTS idx_summaries_project ON session_summaries(project)`,await this.sql`CREATE INDEX IF NOT EXISTS idx_summaries_created ON session_summaries(created_at_epoch DESC)`,await this.sql`CREATE INDEX IF NOT EXISTS idx_summaries_project_created ON session_summaries(project, created_at_epoch DESC)`,await this.sql`CREATE INDEX IF NOT EXISTS idx_summaries_embedding ON session_summaries USING hnsw (embedding vector_cosine_ops)`,await this.sql`CREATE INDEX IF NOT EXISTS idx_summaries_search_vector ON session_summaries USING gin (search_vector)`,await this.sql`CREATE INDEX IF NOT EXISTS idx_prompts_content_session ON user_prompts(content_session_id)`,await this.sql`CREATE INDEX IF NOT EXISTS idx_prompts_created ON user_prompts(created_at_epoch DESC)`,await this.sql`CREATE INDEX IF NOT EXISTS idx_prompts_lookup ON user_prompts(content_session_id, prompt_number)`,await this.sql`CREATE INDEX IF NOT EXISTS idx_prompts_embedding ON user_prompts USING hnsw (embedding vector_cosine_ops)`,await this.sql`CREATE INDEX IF NOT EXISTS idx_prompts_search_vector ON user_prompts USING gin (search_vector)`,await this.sql`CREATE INDEX IF NOT EXISTS idx_pending_messages_session ON pending_messages(session_db_id)`,await this.sql`CREATE INDEX IF NOT EXISTS idx_pending_messages_status ON pending_messages(status)`,await this.sql`CREATE INDEX IF NOT EXISTS idx_pending_messages_content_session ON pending_messages(content_session_id)`}async migrationV3_TsvectorTriggers(){await this.sql`
      CREATE OR REPLACE FUNCTION observations_search_vector_update() RETURNS trigger AS $$
      BEGIN
        NEW.search_vector :=
          setweight(to_tsvector('english', COALESCE(NEW.title, '')), 'A') ||
          setweight(to_tsvector('english', COALESCE(NEW.subtitle, '')), 'B') ||
          setweight(to_tsvector('english', COALESCE(NEW.narrative, '')), 'B') ||
          setweight(to_tsvector('english', COALESCE(NEW.facts, '')), 'C') ||
          setweight(to_tsvector('english', COALESCE(NEW.concepts, '')), 'C');
        RETURN NEW;
      END
      $$ LANGUAGE plpgsql
    `,await this.sql`
      DROP TRIGGER IF EXISTS observations_search_vector_trigger ON observations
    `,await this.sql`
      CREATE TRIGGER observations_search_vector_trigger
        BEFORE INSERT OR UPDATE ON observations
        FOR EACH ROW EXECUTE FUNCTION observations_search_vector_update()
    `,await this.sql`
      CREATE OR REPLACE FUNCTION summaries_search_vector_update() RETURNS trigger AS $$
      BEGIN
        NEW.search_vector :=
          setweight(to_tsvector('english', COALESCE(NEW.request, '')), 'A') ||
          setweight(to_tsvector('english', COALESCE(NEW.investigated, '')), 'B') ||
          setweight(to_tsvector('english', COALESCE(NEW.learned, '')), 'B') ||
          setweight(to_tsvector('english', COALESCE(NEW.completed, '')), 'B') ||
          setweight(to_tsvector('english', COALESCE(NEW.next_steps, '')), 'C') ||
          setweight(to_tsvector('english', COALESCE(NEW.notes, '')), 'D');
        RETURN NEW;
      END
      $$ LANGUAGE plpgsql
    `,await this.sql`
      DROP TRIGGER IF EXISTS summaries_search_vector_trigger ON session_summaries
    `,await this.sql`
      CREATE TRIGGER summaries_search_vector_trigger
        BEFORE INSERT OR UPDATE ON session_summaries
        FOR EACH ROW EXECUTE FUNCTION summaries_search_vector_update()
    `,await this.sql`
      CREATE OR REPLACE FUNCTION prompts_search_vector_update() RETURNS trigger AS $$
      BEGIN
        NEW.search_vector :=
          setweight(to_tsvector('english', COALESCE(NEW.prompt_text, '')), 'A');
        RETURN NEW;
      END
      $$ LANGUAGE plpgsql
    `,await this.sql`
      DROP TRIGGER IF EXISTS prompts_search_vector_trigger ON user_prompts
    `,await this.sql`
      CREATE TRIGGER prompts_search_vector_trigger
        BEFORE INSERT OR UPDATE ON user_prompts
        FOR EACH ROW EXECUTE FUNCTION prompts_search_vector_update()
    `}async migrationV4_RLSPolicies(){let e=["sdk_sessions","observations","session_summaries","user_prompts","pending_messages"];for(let t of e)await this.sql`ALTER TABLE ${this.sql(t)} ENABLE ROW LEVEL SECURITY`,await this.sql.unsafe(`DROP POLICY IF EXISTS project_isolation ON ${t}`),t==="pending_messages"||t==="user_prompts"?await this.sql.unsafe(`
          CREATE POLICY project_isolation ON ${t}
            FOR ALL
            USING (
              current_setting('app.current_project', true) IS NULL
              OR current_setting('app.current_project', true) = ''
              OR content_session_id IN (
                SELECT content_session_id FROM sdk_sessions
                WHERE project = current_setting('app.current_project', true)
              )
            )
        `):await this.sql.unsafe(`
          CREATE POLICY project_isolation ON ${t}
            FOR ALL
            USING (
              current_setting('app.current_project', true) IS NULL
              OR current_setting('app.current_project', true) = ''
              OR project = current_setting('app.current_project', true)
            )
        `);for(let t of e)await this.sql`ALTER TABLE ${this.sql(t)} FORCE ROW LEVEL SECURITY`}async migrationV5_JapaneseFTS(){let[e]=await this.sql`
      SELECT 1 FROM pg_available_extensions WHERE name = 'pg_bigm'
    `;if(!e){S.info("DB","pg_bigm extension not available, skipping Japanese FTS indexes (English tsvector still active)");return}await this.sql`CREATE EXTENSION IF NOT EXISTS pg_bigm`,await this.sql`CREATE INDEX IF NOT EXISTS idx_observations_title_bigm ON observations USING gin (title gin_bigm_ops)`,await this.sql`CREATE INDEX IF NOT EXISTS idx_observations_narrative_bigm ON observations USING gin (narrative gin_bigm_ops)`,await this.sql`CREATE INDEX IF NOT EXISTS idx_summaries_request_bigm ON session_summaries USING gin (request gin_bigm_ops)`,await this.sql`CREATE INDEX IF NOT EXISTS idx_prompts_text_bigm ON user_prompts USING gin (prompt_text gin_bigm_ops)`,S.info("DB","pg_bigm extension enabled for Japanese full-text search")}}});function fi(s){if(mt.has(s))return mt.get(s);let e=Error.stackTraceLimit;return Error.stackTraceLimit=4,mt.set(s,new Error),Error.stackTraceLimit=e,mt.get(s)}var mt,ns,os,xe,de,lt=K(()=>{mt=new Map,ns=new Map,os=Symbol("OriginError"),xe={},de=class extends Promise{constructor(e,t,r,n,o={}){let i,a;super((d,m)=>{i=d,a=m}),this.tagged=Array.isArray(e.raw),this.strings=e,this.args=t,this.handler=r,this.canceller=n,this.options=o,this.state=null,this.statement=null,this.resolve=d=>(this.active=!1,i(d)),this.reject=d=>(this.active=!1,a(d)),this.active=!1,this.cancelled=null,this.executed=!1,this.signature="",this[os]=this.handler.debug?new Error:this.tagged&&fi(this.strings)}get origin(){return(this.handler.debug?this[os].stack:this.tagged&&ns.has(this.strings)?ns.get(this.strings):ns.set(this.strings,this[os].stack).get(this.strings))||""}static get[Symbol.species](){return Promise}cancel(){return this.canceller&&(this.canceller(this),this.canceller=null)}simple(){return this.options.simple=!0,this.options.prepare=!1,this}async readable(){return this.simple(),this.streaming=!0,this}async writable(){return this.simple(),this.streaming=!0,this}cursor(e=1,t){if(this.options.simple=!1,typeof e=="function"&&(t=e,e=1),this.cursorRows=e,typeof t=="function")return this.cursorFn=t,this;let r;return{[Symbol.asyncIterator]:()=>({next:()=>{if(this.executed&&!this.active)return{done:!0};r&&r();let n=new Promise((o,i)=>{this.cursorFn=a=>(o({value:a,done:!1}),new Promise(d=>r=d)),this.resolve=()=>(this.active=!1,o({done:!0})),this.reject=a=>(this.active=!1,i(a))});return this.execute(),n},return(){return r&&r(xe),{done:!0}}})}}describe(){return this.options.simple=!1,this.onlyDescribe=this.options.prepare=!0,this}stream(){throw new Error(".stream has been renamed to .forEach")}forEach(e){return this.forEachFn=e,this.handle(),this}raw(){return this.isRaw=!0,this}values(){return this.isRaw="values",this}async handle(){!this.executed&&(this.executed=!0)&&await 1&&this.handler(this)}execute(){return this.handle(),this}then(){return this.handle(),super.then.apply(this,arguments)}catch(){return this.handle(),super.catch.apply(this,arguments)}finally(){return this.handle(),super.finally.apply(this,arguments)}}});function xr(s,e,t){let{host:r,port:n}=t||e,o=Object.assign(new Error("write "+s+" "+(e.path||r+":"+n)),{code:s,errno:s,address:e.path||r},e.path?{}:{port:n});return Error.captureStackTrace(o,xr),o}function jr(s){let e=new De(s);return Error.captureStackTrace(e,jr),e}function Br(s,e){let t=Object.assign(new Error(s+": "+e),{code:s});return Error.captureStackTrace(t,Br),t}function Hr(s){let e=Object.assign(new Error(s+" (B) is not supported"),{code:"MESSAGE_NOT_SUPPORTED",name:s});return Error.captureStackTrace(e,Hr),e}var De,q,_t=K(()=>{De=class extends Error{constructor(e){super(e.message),this.name=this.constructor.name,Object.assign(this,e)}},q={connection:xr,postgres:jr,generic:Br,notSupported:Hr}});function ht(s,e,t,r){let n=s instanceof _e?s.value:s;if(n===void 0&&(s instanceof _e?s.value=r.transform.undefined:n=s=r.transform.undefined,n===void 0))throw q.generic("UNDEFINED_VALUE","Undefined values are not allowed");return"$"+t.push(s instanceof _e?(e.push(s.value),s.array?s.array[s.type||gt(s.value)]||s.type||qr(s.value):s.type):(e.push(s),gt(s)))}function ds(s,e,t,r,n,o){for(let i=1;i<s.strings.length;i++)e+=us(e,t,r,n,o)+s.strings[i],t=s.args[i];return e}function us(s,e,t,r,n){return e instanceof Je?e.build(s,t,r,n):e instanceof de?cs(e,t,r,n):e instanceof je?e.value:e&&e[0]instanceof de?e.reduce((o,i)=>o+" "+cs(i,t,r,n),""):ht(e,t,r,n)}function cs(s,e,t,r){return s.fragment=!0,ds(s,s.strings[0],s.args[0],e,t,r)}function Gr(s,e,t,r,n){return s.map(o=>"("+r.map(i=>us("values",o[i],e,t,n)).join(",")+")").join(",")}function Wr(s,e,t,r,n){let o=Array.isArray(s[0]),i=e.length?e.flat():Object.keys(o?s[0]:s);return Gr(o?s:[s],t,r,i,n)}function Et(s,e,t,r,n){if(typeof s=="string"&&(s=[s].concat(e)),Array.isArray(s))return ps(s,n);let o;return(e.length?e.flat():Object.keys(s)).map(a=>(o=s[a],(o instanceof de?cs(o,t,r,n):o instanceof je?o.value:ht(o,t,r,n))+" as "+ft(n.transform.column.to?n.transform.column.to(a):a))).join(",")}function is(){throw q.generic("NOT_TAGGED_CALL","Query not called as a tagged template literal")}function qr(s){return Array.isArray(s)?qr(s[0]):typeof s=="string"?1009:0}function Vr(s){return Object.keys(s).reduce((e,t)=>(s[t].from&&[].concat(s[t].from).forEach(r=>e.parsers[r]=s[t].parse),s[t].serialize&&(e.serializers[s[t].to]=s[t].serialize,s[t].from&&[].concat(s[t].from).forEach(r=>e.serializers[r]=s[t].serialize)),e),{parsers:{},serializers:{}})}function ps(s,{transform:{column:e}}){return s.map(t=>ft(e.to?e.to(t):t)).join(",")}function Ni(s){return s.replace(yi,"\\\\").replace(Oi,'\\"')}function Qr(s,e,t,r){let n=[],o=r===1020?";":",";for(;s.i<e.length;s.i++){if(s.char=e[s.i],s.quoted)s.char==="\\"?s.str+=e[++s.i]:s.char==='"'?(n.push(t?t(s.str):s.str),s.str="",s.quoted=e[s.i+1]==='"',s.last=s.i+2):s.str+=s.char;else if(s.char==='"')s.quoted=!0;else if(s.char==="{")s.last=++s.i,n.push(Qr(s,e,t,r));else if(s.char==="}"){s.quoted=!1,s.last<s.i&&n.push(t?t(e.slice(s.last,s.i)):e.slice(s.last,s.i)),s.last=s.i+1;break}else s.char===o&&s.p!=="}"&&s.p!=='"'&&(n.push(t?t(e.slice(s.last,s.i)):e.slice(s.last,s.i)),s.last=s.i+1);s.p=s.char}return s.last<s.i&&n.push(t?t(e.slice(s.last,s.i+1)):e.slice(s.last,s.i+1)),n}function ms(s){return function e(t,r){return typeof t=="object"&&t!==null&&(r.type===114||r.type===3802)?Array.isArray(t)?t.map(n=>e(n,r)):Object.entries(t).reduce((n,[o,i])=>Object.assign(n,{[s(o)]:e(i,r)}),{}):t}}var Ti,Ke,je,_e,Je,Xr,Si,bi,Ri,Yr,ft,gt,yi,Oi,Kr,as,Jr,ve,Le,Me,Qe,ze,Ze,ls,_s,Es,gs=K(()=>{lt();_t();Ti={string:{to:25,from:null,serialize:s=>""+s},number:{to:0,from:[21,23,26,700,701],serialize:s=>""+s,parse:s=>+s},json:{to:114,from:[114,3802],serialize:s=>JSON.stringify(s),parse:s=>JSON.parse(s)},boolean:{to:16,from:16,serialize:s=>s===!0?"t":"f",parse:s=>s==="t"},date:{to:1184,from:[1082,1114,1184],serialize:s=>(s instanceof Date?s:new Date(s)).toISOString(),parse:s=>new Date(s)},bytea:{to:17,from:17,serialize:s=>"\\x"+Buffer.from(s).toString("hex"),parse:s=>Buffer.from(s.slice(2),"hex")}},Ke=class{then(){is()}catch(){is()}finally(){is()}},je=class extends Ke{constructor(e){super(),this.value=ft(e)}},_e=class extends Ke{constructor(e,t,r){super(),this.value=e,this.type=t,this.array=r}},Je=class extends Ke{constructor(e,t){super(),this.first=e,this.rest=t}build(e,t,r,n){let o=Si.map(([i,a])=>({fn:a,i:e.search(i)})).sort((i,a)=>i.i-a.i).pop();return o.i===-1?ps(this.first,n):o.fn(this.first,this.rest,t,r,n)}};Xr=Vr(Ti);Si=Object.entries({values:Wr,in:(...s)=>{let e=Wr(...s);return e==="()"?"(null)":e},select:Et,as:Et,returning:Et,"\\(":Et,update(s,e,t,r,n){return(e.length?e.flat():Object.keys(s)).map(o=>ft(n.transform.column.to?n.transform.column.to(o):o)+"="+us("values",s[o],t,r,n))},insert(s,e,t,r,n){let o=e.length?e.flat():Object.keys(Array.isArray(s)?s[0]:s);return"("+ps(o,n)+")values"+Gr(Array.isArray(s)?s:[s],t,r,o,n)}}).map(([s,e])=>[new RegExp("((?:^|[\\s(])"+s+"(?:$|[\\s(]))(?![\\s\\S]*\\1)","i"),e]);bi=Xr.serializers,Ri=Xr.parsers;Yr=function(s){let e=Vr(s||{});return{serializers:Object.assign({},bi,e.serializers),parsers:Object.assign({},Ri,e.parsers)}};ft=function(e){return'"'+e.replace(/"/g,'""').replace(/\./g,'"."')+'"'},gt=function s(e){return e instanceof _e?e.type:e instanceof Date?1184:e instanceof Uint8Array?17:e===!0||e===!1?16:typeof e=="bigint"?20:Array.isArray(e)?s(e[0]):0},yi=/\\/g,Oi=/"/g;Kr=function s(e,t,r,n){if(Array.isArray(e)===!1)return e;if(!e.length)return"{}";let o=e[0],i=n===1020?";":",";return Array.isArray(o)&&!o.type?"{"+e.map(a=>s(a,t,r,n)).join(i)+"}":"{"+e.map(a=>{if(a===void 0&&(a=r.transform.undefined,a===void 0))throw q.generic("UNDEFINED_VALUE","Undefined values are not allowed");return a===null?"null":'"'+Ni(t?t(a.type?a.value:a):""+a)+'"'}).join(i)+"}"},as={i:0,char:null,str:"",quoted:!1,last:0},Jr=function(e,t,r){return as.i=as.last=0,Qr(as,e,t,r)};ve=s=>{let e=s[0];for(let t=1;t<s.length;t++)e+=s[t]==="_"?s[++t].toUpperCase():s[t];return e},Le=s=>{let e=s[0].toUpperCase();for(let t=1;t<s.length;t++)e+=s[t]==="_"?s[++t].toUpperCase():s[t];return e},Me=s=>s.replace(/_/g,"-"),Qe=s=>s.replace(/([A-Z])/g,"_$1").toLowerCase(),ze=s=>(s.slice(0,1)+s.slice(1).replace(/([A-Z])/g,"_$1")).toLowerCase(),Ze=s=>s.replace(/-/g,"_");ve.column={from:ve};ve.value={from:ms(ve)};Qe.column={to:Qe};ls={...ve};ls.column.to=Qe;Le.column={from:Le};Le.value={from:ms(Le)};ze.column={to:ze};_s={...Le};_s.column.to=ze;Me.column={from:Me};Me.value={from:ms(Me)};Ze.column={to:Ze};Es={...Me};Es.column.to=Ze});var Ie,zr=K(()=>{Ie=class extends Array{constructor(){super(),Object.defineProperties(this,{count:{value:null,writable:!0},state:{value:null,writable:!0},command:{value:null,writable:!0},columns:{value:null,writable:!0},statement:{value:null,writable:!0}})}static get[Symbol.species](){return Array}}});function Ii(s=[]){let e=s.slice(),t=0;return{get length(){return e.length-t},remove:r=>{let n=e.indexOf(r);return n===-1?null:(e.splice(n,1),r)},push:r=>(e.push(r),r),shift:()=>{let r=e[t++];return t===e.length?(t=0,e=[]):e[t-1]=void 0,r}}}var ue,hs=K(()=>{ue=Ii});function Tt(s){if(ee.length-$.i<s){let e=ee,t=e.length;ee=Buffer.allocUnsafe(t+(t>>1)+s),e.copy(ee)}}function Ci(){return $.i=0,$}var ee,Ai,$,N,Zr=K(()=>{ee=Buffer.allocUnsafe(256),Ai="BCcDdEFfHPpQSX".split("").reduce((s,e)=>{let t=e.charCodeAt(0);return s[e]=()=>(ee[0]=t,$.i=5,$),s},{}),$=Object.assign(Ci,Ai,{N:"\0",i:0,inc(s){return $.i+=s,$},str(s){let e=Buffer.byteLength(s);return Tt(e),$.i+=ee.write(s,$.i,e,"utf8"),$},i16(s){return Tt(2),ee.writeUInt16BE(s,$.i),$.i+=2,$},i32(s,e){return e||e===0?(ee.writeUInt32BE(s,e),$):(Tt(4),ee.writeUInt32BE(s,$.i),$.i+=4,$)},z(s){return Tt(s),ee.fill(0,$.i,$.i+s),$.i+=s,$},raw(s){return ee=Buffer.concat([ee.subarray(0,$.i),s]),$.i=ee.length,$},end(s=1){ee.writeUInt32BE($.i-s,s);let e=ee.subarray(0,$.i);return $.i=0,ee=Buffer.allocUnsafe(256),e}}),N=$});function rn(s,e={},{onopen:t=Be,onend:r=Be,onclose:n=Be}={}){let{sslnegotiation:o,ssl:i,max:a,user:d,host:m,port:l,database:g,parsers:h,transform:p,onnotice:y,onnotify:_,onparameter:f,max_pipeline:O,keep_alive:A,backoff:v,target_session_attrs:ae}=s,M=ue(),ye=Di++,he={pid:null,secret:null},we=fs(Ht,s.idle_timeout),Ce=fs(Ht,s.max_lifetime),w=fs(bo,s.connect_timeout),R=null,fe,ne=null,P=new Ie,te=Buffer.alloc(0),Pe=s.fetch_types,Te={},E={},C=Math.random().toString(36).slice(2),x=1,Y=0,X=0,D=0,U=0,H=0,W=0,V=0,se=null,F=null,Se=!1,Ee=null,Oe=null,Q=null,B=null,k=null,ce=null,rt=null,jt=null,b=null,Xe=null,z={queue:e.closed,idleTimer:we,connect(c){Q=c,Bs()},terminate:Ye,execute:Ge,cancel:ho,end:Ht,count:0,id:ye};return e.closed&&e.closed.push(z),z;async function go(){let c;try{c=s.socket?await Promise.resolve(s.socket(s)):new Ts.default.Socket}catch(u){$e(u);return}return c.on("error",$e),c.on("close",Hs),c.on("drain",xs),c}async function ho({pid:c,secret:u},I,L){try{fe=N().i32(16).i32(80877102).i32(c).i32(u).end(16),await js(),R.once("error",L),R.once("close",I)}catch(G){L(G)}}function Ge(c){if(Se)return qe(c,q.connection("CONNECTION_DESTROYED",s));if(k)return qe(c,q.generic("COPY_IN_PROGRESS","You cannot execute queries during copy"));if(!c.cancelled)try{return c.state=he,b?M.push(c):(b=c,b.active=!0),So(c),J(fo(c))&&!c.describeFirst&&!c.cursorFn&&M.length<O&&(!c.options.onexecute||c.options.onexecute(z))}catch(u){return M.length===0&&J(Ae),pe(u),!0}}function fo(c){if(c.parameters.length>=65534)throw q.generic("MAX_PARAMETERS_EXCEEDED","Max number of parameters (65534) exceeded");return c.options.simple?N().Q().str(c.statement.string+N.N).end():c.describeFirst?Buffer.concat([$s(c),en]):c.prepare?c.prepared?nt(c):Buffer.concat([$s(c),nt(c)]):To(c)}function $s(c){return Buffer.concat([Xs(c.statement.string,c.parameters,c.statement.types,c.statement.name),oi("S",c.statement.name)])}function nt(c){return Buffer.concat([ni(c.parameters,c.statement.types,c.statement.name,c.cursorName),c.cursorFn?Gs("",c.cursorRows):Li])}function To(c){return Buffer.concat([Xs(c.statement.string,c.parameters,c.statement.types),Mi,nt(c)])}function So(c){let u=[],I=[],L=ds(c,c.strings[0],c.args[0],u,I,s);!c.tagged&&c.args.forEach(G=>ht(G,u,I,s)),c.prepare=s.prepare&&("prepare"in c.options?c.options.prepare:!0),c.string=L,c.signature=c.prepare&&I+L,c.onlyDescribe&&delete E[c.signature],c.parameters=c.parameters||u,c.prepared=c.prepare&&c.signature in E,c.describeFirst=c.onlyDescribe||u.length&&!c.prepared,c.statement=c.prepared?E[c.signature]:{string:L,types:I,name:c.prepare?C+x++:""},typeof s.debug=="function"&&s.debug(ye,L,u,I)}function J(c,u){return ce=ce?Buffer.concat([ce,c]):Buffer.from(c),u||ce.length>=1024?Fs(u):(F===null&&(F=setImmediate(Fs)),!0)}function Fs(c){let u=R.write(ce,c);return F!==null&&clearImmediate(F),ce=F=null,u}function bo(){pe(q.connection("CONNECT_TIMEOUT",s,R)),R.destroy()}async function ks(){if(o!=="direct"&&(J(vi),!await new Promise(I=>R.once("data",L=>I(L[0]===83)))&&i==="prefer"))return Ue();let c={socket:R,servername:Ts.default.isIP(R.host)?void 0:R.host};o==="direct"&&(c.ALPNProtocols=["postgresql"]),i==="require"||i==="allow"||i==="prefer"?c.rejectUnauthorized=!1:typeof i=="object"&&Object.assign(c,i),R.removeAllListeners(),R=sn.default.connect(c),R.on("secureConnect",Ue),R.on("error",$e),R.on("close",Hs),R.on("drain",xs)}function xs(){!b&&t(z)}function Bt(c){if(!(Ee&&(Ee.push(c),X-=c.length,X>0)))for(te=Ee?Buffer.concat(Ee,H-X):te.length===0?c:Buffer.concat([te,c],te.length+c.length);te.length>4;){if(H=te.readUInt32BE(1),H>=te.length){X=H-te.length,Ee=[te];break}try{Ro(te.subarray(0,H+1))}catch(u){b&&(b.cursorFn||b.describeFirst)&&J(Ae),pe(u)}te=te.subarray(H+1),X=0,Ee=null}}async function js(){if(Se=!1,Te={},R||(R=await go()),!!R){if(w.start(),s.socket)return i?ks():Ue();if(R.on("connect",i?ks:Ue),s.path)return R.connect(s.path);R.ssl=i,R.connect(l[D],m[D]),R.host=m[D],R.port=l[D],D=(D+1)%l.length}}function Bs(){setTimeout(js,Y?Math.max(0,Y+W-Ss.performance.now()):0)}function Ue(){try{E={},Pe=s.fetch_types,C=Math.random().toString(36).slice(2),x=1,Ce.start(),R.on("data",Bt),A&&R.setKeepAlive&&R.setKeepAlive(!0,1e3*A);let c=ai();J(c)}catch(c){$e(c)}}function $e(c){if(!(z.queue===e.connecting&&s.host[U+1]))for(pe(c);M.length;)qe(M.shift(),c)}function pe(c){k&&(k.destroy(c),k=null),b&&qe(b,c),Q&&(qe(Q,c),Q=null)}function qe(c,u){if(c.reserve)return c.reject(u);(!u||typeof u!="object")&&(u=new Error(u)),"query"in u||"parameters"in u||Object.defineProperties(u,{stack:{value:u.stack+c.origin.replace(/.*\n/,`
`),enumerable:s.debug},query:{value:c.string,enumerable:s.debug},parameters:{value:c.parameters,enumerable:s.debug},args:{value:c.args,enumerable:s.debug},types:{value:c.statement&&c.statement.types,enumerable:s.debug}}),c.reject(u)}function Ht(){return B||(!z.reserved&&r(z),!z.reserved&&!Q&&!b&&M.length===0?(Ye(),new Promise(c=>R&&R.readyState!=="closed"?R.once("close",c):c())):B=new Promise(c=>rt=c))}function Ye(){Se=!0,(k||b||Q||M.length)&&$e(q.connection("CONNECTION_DESTROYED",s)),clearImmediate(F),R&&(R.removeListener("data",Bt),R.removeListener("connect",Ue),R.readyState==="open"&&R.end(N().X().end())),rt&&(rt(),B=rt=null)}async function Hs(c){if(te=Buffer.alloc(0),X=0,Ee=null,clearImmediate(F),R.removeListener("data",Bt),R.removeListener("connect",Ue),we.cancel(),Ce.cancel(),w.cancel(),R.removeAllListeners(),R=null,Q)return Bs();!c&&(b||M.length)&&$e(q.connection("CONNECTION_CLOSED",s,R)),Y=Ss.performance.now(),c&&s.shared.retries++,W=(typeof v=="function"?v(s.shared.retries):v)*1e3,n(z,q.connection("CONNECTION_CLOSED",s,R))}function Ro(c,u=c[0]){(u===68?yo:u===100?Jo:u===65?Xo:u===83?Oo:u===90?No:u===67?Io:u===50?Ws:u===49?Ao:u===116?Co:u===84?Do:u===82?vo:u===110?$o:u===75?Fo:u===69?Ho:u===115?Go:u===51?qo:u===71?Yo:u===78?zo:u===72?Vo:u===99?Qo:u===73?Zo:u===86?ei:u===118?ti:u===87?Ko:si)(c)}function yo(c){let u=7,I,L,G,Z=b.isRaw?new Array(b.statement.columns.length):{};for(let re=0;re<b.statement.columns.length;re++)L=b.statement.columns[re],I=c.readInt32BE(u),u+=4,G=I===-1?null:b.isRaw===!0?c.subarray(u,u+=I):L.parser===void 0?c.toString("utf8",u,u+=I):L.parser.array===!0?L.parser(c.toString("utf8",u+1,u+=I)):L.parser(c.toString("utf8",u,u+=I)),b.isRaw?Z[re]=b.isRaw===!0?G:p.value.from?p.value.from(G,L):G:Z[L.name]=p.value.from?p.value.from(G,L):G;b.forEachFn?b.forEachFn(p.row.from?p.row.from(Z):Z,P):P[V++]=p.row.from?p.row.from(Z):Z}function Oo(c){let[u,I]=c.toString("utf8",5,c.length-1).split(N.N);Te[u]=I,s.parameters[u]!==I&&(s.parameters[u]=I,f&&f(u,I))}function No(c){if(b?ne?b.retried?pe(b.retried):b.prepared&&wi.has(ne.routine)?Wo(b,ne):pe(ne):b.resolve(Oe||P):ne&&pe(ne),b=Oe=ne=null,P=new Ie,w.cancel(),Q){if(ae){if(!Te.in_hot_standby||!Te.default_transaction_read_only)return Bo();if(jo(ae,Te))return Ye()}if(Pe)return Q.reserve&&(Q=null),ko();Q&&!Q.reserve&&Ge(Q),s.shared.retries=U=0,Q=null;return}for(;M.length&&(b=M.shift())&&(b.active=!0,b.cancelled);)rn(s).cancel(b.state,b.cancelled.resolve,b.cancelled.reject);b||(z.reserved?!z.reserved.release&&c[5]===73?B?Ye():(z.reserved=null,t(z)):z.reserved():B?Ye():t(z))}function Io(c){V=0;for(let u=c.length-1;u>0;u--)if(c[u]===32&&c[u+1]<58&&P.count===null&&(P.count=+c.toString("utf8",u+1,c.length-1)),c[u-1]>=65){P.command=c.toString("utf8",5,u),P.state=he;break}if(Xe&&(Xe(),Xe=null),P.command==="BEGIN"&&a!==1&&!z.reserved)return pe(q.generic("UNSAFE_TRANSACTION","Only use sql.begin, sql.reserved or max: 1"));if(b.options.simple)return Ws();b.cursorFn&&(P.count&&b.cursorFn(P),J(Ae))}function Ao(){b.parsing=!1}function Ws(){!P.statement&&(P.statement=b.statement),P.columns=b.statement.columns}function Co(c){let u=c.readUInt16BE(5);for(let I=0;I<u;++I)!b.statement.types[I]&&(b.statement.types[I]=c.readUInt32BE(7+I*4));b.prepare&&(E[b.signature]=b.statement),b.describeFirst&&!b.onlyDescribe&&(J(nt(b)),b.describeFirst=!1)}function Do(c){P.command&&(Oe=Oe||[P],Oe.push(P=new Ie),P.count=null,b.statement.columns=null);let u=c.readUInt16BE(5),I=7,L;b.statement.columns=Array(u);for(let G=0;G<u;++G){for(L=I;c[I++]!==0;);let Z=c.readUInt32BE(I),re=c.readUInt16BE(I+4),Ne=c.readUInt32BE(I+6);b.statement.columns[G]={name:p.column.from?p.column.from(c.toString("utf8",L,I-1)):c.toString("utf8",L,I-1),parser:h[Ne],table:Z,number:re,type:Ne},I+=18}if(P.statement=b.statement,b.onlyDescribe)return b.resolve(b.statement),J(Ae)}async function vo(c,u=c.readUInt32BE(5)){(u===3?Lo:u===5?Mo:u===10?wo:u===11?Po:u===12?Uo:u!==0?ri:Be)(c,u)}async function Lo(){let c=await Wt();J(N().p().str(c).z(1).end())}async function Mo(c){let u="md5"+await tn(Buffer.concat([Buffer.from(await tn(await Wt()+d)),c.subarray(9)]));J(N().p().str(u).z(1).end())}async function wo(){jt=(await He.default.randomBytes(18)).toString("base64"),N().p().str("SCRAM-SHA-256"+N.N);let c=N.i;J(N.inc(4).str("n,,n=*,r="+jt).i32(N.i-c-4,c).end())}async function Po(c){let u=c.toString("utf8",9).split(",").reduce((re,Ne)=>(re[Ne[0]]=Ne.slice(2),re),{}),I=await He.default.pbkdf2Sync(await Wt(),Buffer.from(u.s,"base64"),parseInt(u.i),32,"sha256"),L=await bt(I,"Client Key"),G="n=*,r="+jt+",r="+u.r+",s="+u.s+",i="+u.i+",c=biws,r="+u.r;se=(await bt(await bt(I,"Server Key"),G)).toString("base64");let Z="c=biws,r="+u.r+",p="+$i(L,Buffer.from(await bt(await Ui(L),G))).toString("base64");J(N().p().str(Z).end())}function Uo(c){c.toString("utf8",9).split(N.N,1)[0].slice(2)!==se&&(pe(q.generic("SASL_SIGNATURE_MISMATCH","The server did not return the correct signature")),R.destroy())}function Wt(){return Promise.resolve(typeof s.pass=="function"?s.pass():s.pass)}function $o(){if(P.statement=b.statement,P.statement.columns=[],b.onlyDescribe)return b.resolve(b.statement),J(Ae)}function Fo(c){he.pid=c.readUInt32BE(5),he.secret=c.readUInt32BE(9)}async function ko(){Pe=!1,(await new de([`
      select b.oid, b.typarray
      from pg_catalog.pg_type a
      left join pg_catalog.pg_type b on b.oid = a.typelem
      where a.typcategory = 'A'
      group by b.oid, b.typarray
      order by b.oid
    `],[],Ge)).forEach(({oid:u,typarray:I})=>xo(u,I))}function xo(c,u){if(s.parsers[u]&&s.serializers[u])return;let I=s.parsers[c];s.shared.typeArrayMap[c]=u,s.parsers[u]=L=>Jr(L,I,u),s.parsers[u].array=!0,s.serializers[u]=L=>Kr(L,s.serializers[c],s,u)}function jo(c,u){return c==="read-write"&&u.default_transaction_read_only==="on"||c==="read-only"&&u.default_transaction_read_only==="off"||c==="primary"&&u.in_hot_standby==="on"||c==="standby"&&u.in_hot_standby==="off"||c==="prefer-standby"&&u.in_hot_standby==="off"&&s.host[U]}function Bo(){let c=new de([`
      show transaction_read_only;
      select pg_catalog.pg_is_in_recovery()
    `],[],Ge,null,{simple:!0});c.resolve=([[u],[I]])=>{Te.default_transaction_read_only=u.transaction_read_only,Te.in_hot_standby=I.pg_is_in_recovery?"on":"off"},c.execute()}function Ho(c){b?((b.cursorFn||b.describeFirst)&&J(Ae),ne=q.postgres(St(c))):pe(q.postgres(St(c)))}function Wo(c,u){delete E[c.signature],c.retried=u,Ge(c)}function Xo(c){if(!_)return;let u=9;for(;c[u++]!==0;);_(c.toString("utf8",9,u-1),c.toString("utf8",u,c.length-1))}async function Go(){try{let c=await Promise.resolve(b.cursorFn(P));V=0,c===xe?J(ii(b.portal)):(P=new Ie,J(Gs("",b.cursorRows)))}catch(c){J(Ae),b.reject(c)}}function qo(){P.count&&b.cursorFn(P),b.resolve(P)}function Yo(){k=new Rt.default.Writable({autoDestroy:!0,write(c,u,I){R.write(N().d().raw(c).end(),I)},destroy(c,u){u(c),R.write(N().f().str(c+N.N).end()),k=null},final(c){R.write(N().c().end()),Xe=c,k=null}}),b.resolve(k)}function Vo(){k=new Rt.default.Readable({read(){R.resume()}}),b.resolve(k)}function Ko(){k=new Rt.default.Duplex({autoDestroy:!0,read(){R.resume()},write(c,u,I){R.write(N().d().raw(c).end(),I)},destroy(c,u){u(c),R.write(N().f().str(c+N.N).end()),k=null},final(c){R.write(N().c().end()),Xe=c}}),b.resolve(k)}function Jo(c){k&&(k.push(c.subarray(5))||R.pause())}function Qo(){k&&k.push(null),k=null}function zo(c){y?y(St(c)):console.log(St(c))}function Zo(){}function ei(){pe(q.notSupported("FunctionCallResponse"))}function ti(){pe(q.notSupported("NegotiateProtocolVersion"))}function si(c){console.error("Postgres.js : Unknown Message:",c[0])}function ri(c,u){console.error("Postgres.js : Unknown Auth:",u)}function ni(c,u,I="",L=""){let G,Z;return N().B().str(L+N.N).str(I+N.N).i16(0).i16(c.length),c.forEach((re,Ne)=>{if(re===null)return N.i32(4294967295);Z=u[Ne],c[Ne]=re=Z in s.serializers?s.serializers[Z](re):""+re,G=N.i,N.inc(4).str(re).i32(N.i-G-4,G)}),N.i16(0),N.end()}function Xs(c,u,I,L=""){return N().P().str(L+N.N).str(c+N.N).i16(u.length),u.forEach((G,Z)=>N.i32(I[Z]||0)),N.end()}function oi(c,u=""){return N().D().str(c).str(u+N.N).end()}function Gs(c="",u=0){return Buffer.concat([N().E().str(c+N.N).i32(u).end(),en])}function ii(c=""){return Buffer.concat([N().C().str("P").str(c+N.N).end(),N().S().end()])}function ai(){return fe||N().inc(4).i16(3).z(2).str(Object.entries(Object.assign({user:d,database:g,client_encoding:"UTF8"},s.connection)).filter(([,c])=>c).map(([c,u])=>c+N.N+u).join(N.N)).z(2).end(0)}}function St(s){let e={},t=5;for(let r=5;r<s.length-1;r++)s[r]===0&&(e[Pi[s[t]]]=s.toString("utf8",t+1,r),t=r+1);return e}function tn(s){return He.default.createHash("md5").update(s).digest("hex")}function bt(s,e){return He.default.createHmac("sha256",s).update(e).digest()}function Ui(s){return He.default.createHash("sha256").update(s).digest()}function $i(s,e){let t=Math.max(s.length,e.length),r=Buffer.allocUnsafe(t);for(let n=0;n<t;n++)r[n]=s[n]^e[n];return r}function fs(s,e){if(e=typeof e=="function"?e():e,!e)return{cancel:Be,start:Be};let t;return{cancel(){t&&(clearTimeout(t),t=null)},start(){t&&clearTimeout(t),t=setTimeout(r,e*1e3,arguments)}};function r(n){s.apply(null,n),t=null}}var Ts,sn,He,Rt,Ss,bs,Di,Ae,en,vi,Li,Mi,Be,wi,Pi,nn=K(()=>{Ts=me(require("net"),1),sn=me(require("tls"),1),He=me(require("crypto"),1),Rt=me(require("stream"),1),Ss=require("perf_hooks");gs();_t();zr();hs();lt();Zr();bs=rn,Di=1,Ae=N().S().end(),en=N().H().end(),vi=N().i32(8).i32(80877103).end(8),Li=Buffer.concat([N().E().str(N.N).i32(0).end(),Ae]),Mi=N().D().str("S").str(N.N).end(),Be=()=>{},wi=new Set(["FetchPreparedStatement","RevalidateCachedQuery","transformAssignedExpr"]),Pi={83:"severity_local",86:"severity",67:"code",77:"message",68:"detail",72:"hint",80:"position",112:"internal_position",113:"internal_query",87:"where",115:"schema_name",116:"table_name",99:"column_name",100:"data type_name",110:"constraint_name",70:"file",76:"line",82:"routine"}});function Rs(s,e){let t=new Map,r="postgresjs_"+Math.random().toString(36).slice(2),n={},o,i,a=!1,d=g.sql=s({...e,transform:{column:{},value:{},row:{}},max:1,fetch_types:!1,idle_timeout:null,max_lifetime:null,connection:{...e.connection,replication:"database"},onclose:async function(){a||(i=null,n.pid=n.secret=void 0,h(await p(d,r,e.publications)),t.forEach(_=>_.forEach(({onsubscribe:f})=>f())))},no_subscribe:!0}),m=d.end,l=d.close;return d.end=async()=>(a=!0,i&&await new Promise(_=>(i.once("close",_),i.end())),m()),d.close=async()=>(i&&await new Promise(_=>(i.once("close",_),i.end())),l()),g;async function g(_,f,O=on,A=on){_=xi(_),o||(o=p(d,r,e.publications));let v={fn:f,onsubscribe:O},ae=t.has(_)?t.get(_).add(v):t.set(_,new Set([v])).get(_),M=()=>{ae.delete(v),ae.size===0&&t.delete(_)};return o.then(ye=>(h(ye),O(),i&&i.on("error",A),{unsubscribe:M,state:n,sql:d}))}function h(_){i=_.stream,n.pid=_.state.pid,n.secret=_.state.secret}async function p(_,f,O){if(!O)throw new Error("Missing publication names");let A=await _.unsafe(`CREATE_REPLICATION_SLOT ${f} TEMPORARY LOGICAL pgoutput NOEXPORT_SNAPSHOT`),[v]=A,ae=await _.unsafe(`START_REPLICATION SLOT ${f} LOGICAL ${v.consistent_point} (proto_version '1', publication_names '${O}')`).writable(),M={lsn:Buffer.concat(v.consistent_point.split("/").map(w=>Buffer.from(("00000000"+w).slice(-8),"hex")))};return ae.on("data",he),ae.on("error",ye),ae.on("close",_.close),{stream:ae,state:A.state};function ye(w){console.error("Unexpected error during logical streaming - reconnecting",w)}function he(w){w[0]===119?ki(w.subarray(25),M,_.options.parsers,we,e.transform):w[0]===107&&w[17]&&(M.lsn=w.subarray(1,9),Ce())}function we(w,R){let fe=R.relation.schema+"."+R.relation.table;y("*",w,R),y("*:"+fe,w,R),R.relation.keys.length&&y("*:"+fe+"="+R.relation.keys.map(ne=>w[ne.name]),w,R),y(R.command,w,R),y(R.command+":"+fe,w,R),R.relation.keys.length&&y(R.command+":"+fe+"="+R.relation.keys.map(ne=>w[ne.name]),w,R)}function Ce(){let w=Buffer.alloc(34);w[0]=114,w.fill(M.lsn,1),w.writeBigInt64BE(BigInt(Date.now()-Date.UTC(2e3,0,1))*BigInt(1e3),25),ae.write(w)}}function y(_,f,O){t.has(_)&&t.get(_).forEach(({fn:A})=>A(f,O,_))}}function Fi(s){return new Date(Date.UTC(2e3,0,1)+Number(s/BigInt(1e3)))}function ki(s,e,t,r,n){let o=(i,[a,d])=>(i[a.charCodeAt(0)]=d,i);Object.entries({R:i=>{let a=1,d=e[i.readUInt32BE(a)]={schema:i.toString("utf8",a+=4,a=i.indexOf(0,a))||"pg_catalog",table:i.toString("utf8",a+1,a=i.indexOf(0,a+1)),columns:Array(i.readUInt16BE(a+=2)),keys:[]};a+=2;let m=0,l;for(;a<i.length;)l=d.columns[m++]={key:i[a++],name:n.column.from?n.column.from(i.toString("utf8",a,a=i.indexOf(0,a))):i.toString("utf8",a,a=i.indexOf(0,a)),type:i.readUInt32BE(a+=1),parser:t[i.readUInt32BE(a)],atttypmod:i.readUInt32BE(a+=4)},l.key&&d.keys.push(l),a+=4},Y:()=>{},O:()=>{},B:i=>{e.date=Fi(i.readBigInt64BE(9)),e.lsn=i.subarray(1,9)},I:i=>{let a=1,d=e[i.readUInt32BE(a)],{row:m}=yt(i,d.columns,a+=7,n);r(m,{command:"insert",relation:d})},D:i=>{let a=1,d=e[i.readUInt32BE(a)];a+=4;let m=i[a]===75;r(m||i[a]===79?yt(i,d.columns,a+=3,n).row:null,{command:"delete",relation:d,key:m})},U:i=>{let a=1,d=e[i.readUInt32BE(a)];a+=4;let m=i[a]===75,l=m||i[a]===79?yt(i,d.columns,a+=3,n):null;l&&(a=l.i);let{row:g}=yt(i,d.columns,a+3,n);r(g,{command:"update",relation:d,key:m,old:l&&l.row})},T:()=>{},C:()=>{}}).reduce(o,{})[s[0]](s)}function yt(s,e,t,r){let n,o,i,a=r.raw?new Array(e.length):{};for(let d=0;d<e.length;d++)n=s[t++],o=e[d],i=n===110?null:n===117?void 0:o.parser===void 0?s.toString("utf8",t+4,t+=4+s.readUInt32BE(t)):o.parser.array===!0?o.parser(s.toString("utf8",t+5,t+=4+s.readUInt32BE(t))):o.parser(s.toString("utf8",t+4,t+=4+s.readUInt32BE(t))),r.raw?a[d]=r.raw===!0?i:r.value.from?r.value.from(i,o):i:a[o.name]=r.value.from?r.value.from(i,o):i;return{i:t,row:r.row.from?r.row.from(a):a}}function xi(s){let e=s.match(/^(\*|insert|update|delete)?:?([^.]+?\.?[^=]+)?=?(.+)?/i)||[];if(!e)throw new Error("Malformed subscribe pattern: "+s);let[,t,r,n]=e;return(t||"*")+(r?":"+(r.indexOf(".")===-1?"public."+r:r):"")+(n?"="+n:"")}var on,an=K(()=>{on=()=>{}});function Os(s,e,t=393216){return new Promise(async(r,n)=>{await s.begin(async o=>{let i;!e&&([{oid:e}]=await o`select lo_creat(-1) as oid`);let[{fd:a}]=await o`select lo_open(${e}, ${t}) as fd`,d={writable:l,readable:m,close:()=>o`select lo_close(${a})`.then(i),tell:()=>o`select lo_tell64(${a})`,read:g=>o`select loread(${a}, ${g}) as data`,write:g=>o`select lowrite(${a}, ${g})`,truncate:g=>o`select lo_truncate64(${a}, ${g})`,seek:(g,h=0)=>o`select lo_lseek64(${a}, ${g}, ${h})`,size:()=>o`
          select
            lo_lseek64(${a}, location, 0) as position,
            seek.size
          from (
            select
              lo_lseek64($1, 0, 2) as size,
              tell.location
            from (select lo_tell64($1) as location) tell
          ) seek
        `};return r(d),new Promise(async g=>i=g);async function m({highWaterMark:g=2048*8,start:h=0,end:p=1/0}={}){let y=p-h;return h&&await d.seek(h),new ys.default.Readable({highWaterMark:g,async read(_){let f=_>y?_-y:_;y-=_;let[{data:O}]=await d.read(f);this.push(O),O.length<_&&this.push(null)}})}async function l({highWaterMark:g=2048*8,start:h=0}={}){return h&&await d.seek(h),new ys.default.Writable({highWaterMark:g,write(p,y,_){d.write(p).then(()=>_(),_)}})}}).catch(n)})}var ys,cn=K(()=>{ys=me(require("stream"),1)});var pn={};it(pn,{default:()=>ji});function Ot(s,e){let t=Bi(s,e),r=t.no_subscribe||Rs(Ot,{...t}),n=!1,o=ue(),i=ue(),a=ue(),d=ue(),m=ue(),l=ue(),g=ue(),h=ue(),p={connecting:i,reserved:a,closed:d,ended:m,open:l,busy:g,full:h},y=[...Array(t.max)].map(()=>bs(t,p,{onopen:Pe,onend:te,onclose:Te})),_=f(we);return Object.assign(_,{get parameters(){return t.parameters},largeObject:Os.bind(null,_),subscribe:r,CLOSE:xe,END:xe,PostgresError:De,options:t,reserve:v,listen:O,begin:ae,close:fe,end:R}),_;function f(E){return E.debug=t.debug,Object.entries(t.types).reduce((D,[U,H])=>(D[U]=W=>new _e(W,H.to),D),C),Object.assign(x,{types:C,typed:C,unsafe:Y,notify:A,array:he,json:ye,file:X}),x;function C(D,U){return new _e(D,U)}function x(D,...U){return D&&Array.isArray(D.raw)?new de(D,U,E,w):typeof D=="string"&&!U.length?new je(t.transform.column.to?t.transform.column.to(D):D):new Je(D,U)}function Y(D,U=[],H={}){return arguments.length===2&&!Array.isArray(U)&&(H=U,U=[]),new de([D],U,E,w,{prepare:!1,...H,simple:"simple"in H?H.simple:U.length===0})}function X(D,U=[],H={}){return arguments.length===2&&!Array.isArray(U)&&(H=U,U=[]),new de([],U,V=>{un.default.readFile(D,"utf8",(se,F)=>{if(se)return V.reject(se);V.strings=[F],E(V)})},w,{...H,simple:"simple"in H?H.simple:U.length===0})}}async function O(E,C,x){let Y={fn:C,onlisten:x},X=O.sql||(O.sql=Ot({...t,max:1,idle_timeout:null,max_lifetime:null,fetch_types:!1,onclose(){Object.entries(O.channels).forEach(([V,{listeners:se}])=>{delete O.channels[V],Promise.all(se.map(F=>O(V,F.fn,F.onlisten).catch(()=>{})))})},onnotify(V,se){V in O.channels&&O.channels[V].listeners.forEach(F=>F.fn(se))}})),D=O.channels||(O.channels={});if(E in D){D[E].listeners.push(Y);let V=await D[E].result;return Y.onlisten&&Y.onlisten(),{state:V.state,unlisten:W}}D[E]={result:X`listen ${X.unsafe('"'+E.replace(/"/g,'""')+'"')}`,listeners:[Y]};let H=await D[E].result;return Y.onlisten&&Y.onlisten(),{state:H.state,unlisten:W};async function W(){if(E in D&&(D[E].listeners=D[E].listeners.filter(V=>V!==Y),!D[E].listeners.length))return delete D[E],X`unlisten ${X.unsafe('"'+E.replace(/"/g,'""')+'"')}`}}async function A(E,C){return await _`select pg_notify(${E}, ${""+C})`}async function v(){let E=ue(),C=l.length?l.shift():await new Promise((X,D)=>{let U={reserve:X,reject:D};o.push(U),d.length&&P(d.shift(),U)});M(C,a),C.reserved=()=>E.length?C.execute(E.shift()):M(C,a),C.reserved.release=!0;let x=f(Y);return x.release=()=>{C.reserved=null,Pe(C)},x;function Y(X){C.queue===h?E.push(X):C.execute(X)||M(C,h)}}async function ae(E,C){!C&&(C=E,E="");let x=ue(),Y=0,X,D=null;try{return await _.unsafe("begin "+E.replace(/[^a-z ]/ig,""),[],{onexecute:H}).execute(),await Promise.race([U(X,C),new Promise((W,V)=>X.onclose=V)])}catch(W){throw W}async function U(W,V,se){let F=f(Q);F.savepoint=Oe,F.prepare=B=>D=B.replace(/[^a-z0-9$-_. ]/gi);let Se,Ee;se&&await F`savepoint ${F(se)}`;try{if(Ee=await new Promise((B,k)=>{let ce=V(F);Promise.resolve(Array.isArray(ce)?Promise.all(ce):ce).then(B,k)}),Se)throw Se}catch(B){throw await(se?F`rollback to ${F(se)}`:F`rollback`),B instanceof De&&B.code==="25P02"&&Se||B}return se||(D?await F`prepare transaction '${F.unsafe(D)}'`:await F`commit`),Ee;function Oe(B,k){return B&&Array.isArray(B.raw)?Oe(ce=>ce.apply(ce,arguments)):(arguments.length===1&&(k=B,B=null),U(W,k,"s"+Y+++(B?"_"+B:"")))}function Q(B){B.catch(k=>Se||(Se=k)),W.queue===h?x.push(B):W.execute(B)||M(W,h)}}function H(W){X=W,M(W,a),W.reserved=()=>x.length?W.execute(x.shift()):M(W,a)}}function M(E,C){return E.queue.remove(E),C.push(E),E.queue=C,C===l?E.idleTimer.start():E.idleTimer.cancel(),E}function ye(E){return new _e(E,3802)}function he(E,C){return Array.isArray(E)?new _e(E,C||(E.length?gt(E)||25:0),t.shared.typeArrayMap):he(Array.from(arguments))}function we(E){if(n)return E.reject(q.connection("CONNECTION_ENDED",t,t));if(l.length)return Ce(l.shift(),E);if(d.length)return P(d.shift(),E);g.length?Ce(g.shift(),E):o.push(E)}function Ce(E,C){return E.execute(C)?M(E,g):M(E,h)}function w(E){return new Promise((C,x)=>{E.state?E.active?bs(t).cancel(E.state,C,x):E.cancelled={resolve:C,reject:x}:(o.remove(E),E.cancelled=!0,E.reject(q.generic("57014","canceling statement due to user request")),C())})}async function R({timeout:E=null}={}){if(n)return n;await 1;let C;return n=Promise.race([new Promise(x=>E!==null&&(C=setTimeout(ne,E*1e3,x))),Promise.all(y.map(x=>x.end()).concat(O.sql?O.sql.end({timeout:0}):[],r.sql?r.sql.end({timeout:0}):[]))]).then(()=>clearTimeout(C))}async function fe(){await Promise.all(y.map(E=>E.end()))}async function ne(E){for(await Promise.all(y.map(C=>C.terminate()));o.length;)o.shift().reject(q.connection("CONNECTION_DESTROYED",t));E()}function P(E,C){return M(E,i),E.connect(C),E}function te(E){M(E,m)}function Pe(E){if(o.length===0)return M(E,l);let C=Math.ceil(o.length/(i.length+1)),x=!0;for(;x&&o.length&&C-- >0;){let Y=o.shift();if(Y.reserve)return Y.reserve(E);x=E.execute(Y)}x?M(E,g):M(E,h)}function Te(E,C){M(E,d),E.reserved=null,E.onclose&&(E.onclose(C),E.onclose=null),t.onclose&&t.onclose(E.id),o.length&&P(E,o.shift())}}function Bi(s,e){if(s&&s.shared)return s;let t=process.env,r=(!s||typeof s=="string"?e:s)||{},{url:n,multihost:o}=qi(s),i=[...n.searchParams].reduce((h,[p,y])=>(h[p]=y,h),{}),a=r.hostname||r.host||o||n.hostname||t.PGHOST||"localhost",d=r.port||n.port||t.PGPORT||5432,m=r.user||r.username||n.username||t.PGUSERNAME||t.PGUSER||Yi();r.no_prepare&&(r.prepare=!1),i.sslmode&&(i.ssl=i.sslmode,delete i.sslmode),"timeout"in r&&(console.log("The timeout option is deprecated, use idle_timeout instead"),r.idle_timeout=r.timeout),i.sslrootcert==="system"&&(i.ssl="verify-full");let l=["idle_timeout","connect_timeout","max_lifetime","max_pipeline","backoff","keep_alive"],g={max:globalThis.Cloudflare?3:10,ssl:!1,sslnegotiation:null,idle_timeout:null,connect_timeout:30,max_lifetime:Xi,max_pipeline:100,backoff:Wi,keep_alive:60,prepare:!0,debug:!1,fetch_types:!0,publications:"alltables",target_session_attrs:null};return{host:Array.isArray(a)?a:a.split(",").map(h=>h.split(":")[0]),port:Array.isArray(d)?d:a.split(",").map(h=>parseInt(h.split(":")[1]||d)),path:r.path||a.indexOf("/")>-1&&a+"/.s.PGSQL."+d,database:r.database||r.db||(n.pathname||"").slice(1)||t.PGDATABASE||m,user:m,pass:r.pass||r.password||n.password||t.PGPASSWORD||"",...Object.entries(g).reduce((h,[p,y])=>{let _=p in r?r[p]:p in i?i[p]==="disable"||i[p]==="false"?!1:i[p]:t["PG"+p.toUpperCase()]||y;return h[p]=typeof _=="string"&&l.includes(p)?+_:_,h},{}),connection:{application_name:t.PGAPPNAME||"postgres.js",...r.connection,...Object.entries(i).reduce((h,[p,y])=>(p in g||(h[p]=y),h),{})},types:r.types||{},target_session_attrs:Hi(r,n,t),onnotice:r.onnotice,onnotify:r.onnotify,onclose:r.onclose,onparameter:r.onparameter,socket:r.socket,transform:Gi(r.transform||{undefined:void 0}),parameters:{},shared:{retries:0,typeArrayMap:{}},...Yr(r.types)}}function Hi(s,e,t){let r=s.target_session_attrs||e.searchParams.get("target_session_attrs")||t.PGTARGETSESSIONATTRS;if(!r||["read-write","read-only","primary","standby","prefer-standby"].includes(r))return r;throw new Error("target_session_attrs "+r+" is not supported")}function Wi(s){return(.5+Math.random()/2)*Math.min(3**s/100,20)}function Xi(){return 60*(30+Math.random()*30)}function Gi(s){return{undefined:s.undefined,column:{from:typeof s.column=="function"?s.column:s.column&&s.column.from,to:s.column&&s.column.to},value:{from:typeof s.value=="function"?s.value:s.value&&s.value.from,to:s.value&&s.value.to},row:{from:typeof s.row=="function"?s.row:s.row&&s.row.from,to:s.row&&s.row.to}}}function qi(s){if(!s||typeof s!="string")return{url:{searchParams:new Map}};let e=s;e=e.slice(e.indexOf("://")+3).split(/[?/]/)[0],e=decodeURIComponent(e.slice(e.indexOf("@")+1));let t=new URL(s.replace(e,e.split(",")[0]));return{url:{username:decodeURIComponent(t.username),password:decodeURIComponent(t.password),host:t.host,hostname:t.hostname,port:t.port,pathname:t.pathname,searchParams:t.searchParams},multihost:e.indexOf(",")>-1&&e}}function Yi(){try{return dn.default.userInfo().username}catch{return process.env.USERNAME||process.env.USER||process.env.LOGNAME}}var dn,un,ji,mn=K(()=>{dn=me(require("os"),1),un=me(require("fs"),1);gs();nn();lt();hs();_t();an();cn();Object.assign(Ot,{PostgresError:De,toPascal:Le,pascal:_s,toCamel:ve,camel:ls,toKebab:Me,kebab:Es,fromPascal:ze,fromCamel:Qe,fromKebab:Ze,BigInt:{to:20,from:[20],parse:s=>BigInt(s),serialize:s=>s.toString()}});ji=Ot});var _n={};it(_n,{PostgresStorageRepository:()=>Ns});var ln,Nt,It,At,Ct,Dt,vt,Lt,Ns,En=K(()=>{"use strict";kr();oe();ln=require("crypto"),Nt=class{constructor(e){this.sql=e}async createSDKSession(e,t,r,n){let o=Date.now(),[i]=await this.sql`
      INSERT INTO sdk_sessions (content_session_id, project, user_prompt, custom_title, started_at_epoch)
      VALUES (${e}, ${t}, ${r}, ${n??null}, ${o})
      ON CONFLICT (content_session_id) DO NOTHING
      RETURNING id
    `;if(i)return i.id;let[a]=await this.sql`
      SELECT id FROM sdk_sessions WHERE content_session_id = ${e}
    `;return a.id}async updateMemorySessionId(e,t){await this.sql`
      UPDATE sdk_sessions SET memory_session_id = ${t}
      WHERE id = ${e}
    `}async updateSessionStatus(e,t){let r=t==="completed"||t==="failed"?Date.now():null;await this.sql`
      UPDATE sdk_sessions
      SET status = ${t}, completed_at_epoch = ${r},
          completed_at = ${r?new Date().toISOString():null}
      WHERE content_session_id = ${e}
    `}async getSessionByContentId(e){let[t]=await this.sql`
      SELECT * FROM sdk_sessions WHERE content_session_id = ${e}
    `;return t?this.mapRow(t):null}async getSessionByMemoryId(e){let[t]=await this.sql`
      SELECT * FROM sdk_sessions WHERE memory_session_id = ${e}
    `;return t?this.mapRow(t):null}async getSessionById(e){let[t]=await this.sql`
      SELECT * FROM sdk_sessions WHERE id = ${e}
    `;return t?this.mapRow(t):null}async getAllProjects(){return(await this.sql`
      SELECT DISTINCT project FROM sdk_sessions ORDER BY project
    `).map(t=>t.project)}async getSessionsByProject(e,t=100){return(await this.sql`
      SELECT * FROM sdk_sessions WHERE project = ${e}
      ORDER BY started_at_epoch DESC LIMIT ${t}
    `).map(n=>this.mapRow(n))}async getRecentSessionsWithStatus(e,t=10){return(await this.sql`
      SELECT s.memory_session_id, s.status, s.started_at, s.user_prompt,
             EXISTS(SELECT 1 FROM session_summaries ss WHERE ss.memory_session_id = s.memory_session_id) as has_summary
      FROM sdk_sessions s
      WHERE s.project = ${e}
      ORDER BY s.started_at_epoch DESC
      LIMIT ${t}
    `).map(n=>({memory_session_id:n.memory_session_id,status:n.status,started_at:n.started_at instanceof Date?n.started_at.toISOString():String(n.started_at),user_prompt:n.user_prompt,has_summary:n.has_summary}))}async getSessionsByMemoryIds(e){return e.length===0?[]:(await this.sql`
      SELECT * FROM sdk_sessions WHERE memory_session_id = ANY(${e})
    `).map(r=>this.mapRow(r))}mapRow(e){return{id:e.id,content_session_id:e.content_session_id,memory_session_id:e.memory_session_id,project:e.project,user_prompt:e.user_prompt,custom_title:e.custom_title,status:e.status,cwd:e.cwd,hostname:e.hostname,mode:e.mode,worker_port:e.worker_port,prompt_counter:e.prompt_counter??0,started_at:e.started_at instanceof Date?e.started_at.toISOString():String(e.started_at??""),started_at_epoch:Number(e.started_at_epoch),completed_at:e.completed_at instanceof Date?e.completed_at.toISOString():e.completed_at??null,completed_at_epoch:e.completed_at_epoch?Number(e.completed_at_epoch):null}}},It=class{constructor(e){this.sql=e}async storeObservation(e,t,r,n,o,i){let a=i??Date.now(),d=this.computeContentHash(r),m=JSON.stringify(r.facts||[]),l=JSON.stringify(r.concepts||[]),g=JSON.stringify(r.files_read||[]),h=JSON.stringify(r.files_modified||[]),p=a-864e5,[y]=await this.sql`
      SELECT id, created_at_epoch FROM observations
      WHERE content_hash = ${d} AND created_at_epoch > ${p}
      LIMIT 1
    `;if(y)return{id:y.id,createdAtEpoch:Number(y.created_at_epoch)};let[_]=await this.sql`
      INSERT INTO observations (
        memory_session_id, project, type, title, subtitle, facts, narrative,
        concepts, files_read, files_modified, prompt_number, discovery_tokens,
        content_hash, created_at_epoch
      ) VALUES (
        ${e}, ${t}, ${r.type},
        ${r.title||null}, ${r.subtitle||null},
        ${m}, ${r.narrative||null},
        ${l}, ${g}, ${h},
        ${n??null}, ${o??0},
        ${d}, ${a}
      )
      RETURNING id, created_at_epoch
    `;return{id:_.id,createdAtEpoch:Number(_.created_at_epoch)}}async getObservationsByIds(e,t){if(e.length===0)return[];let r=[`id = ANY(ARRAY[${e.join(",")}])`];if(t?.project&&r.push(`project = '${this.escapeStr(t.project)}'`),t?.type){let a=Array.isArray(t.type)?t.type:[t.type];r.push(`type = ANY(ARRAY[${a.map(d=>`'${this.escapeStr(d)}'`).join(",")}])`)}let n=t?.orderBy==="date_asc"?"ASC":"DESC",o=t?.limit?`LIMIT ${t.limit}`:"";return(await this.sql.unsafe(`SELECT * FROM observations WHERE ${r.join(" AND ")}
       ORDER BY created_at_epoch ${n} ${o}`)).map(a=>this.mapRow(a))}async getObservationById(e){let[t]=await this.sql`
      SELECT * FROM observations WHERE id = ${e}
    `;return t?this.mapRow(t):null}async getRecentObservations(e,t=50){return(await this.sql`
      SELECT * FROM observations WHERE project = ${e}
      ORDER BY created_at_epoch DESC LIMIT ${t}
    `).map(n=>this.mapRow(n))}async getAllRecentObservations(e=50){return(await this.sql`
      SELECT * FROM observations ORDER BY created_at_epoch DESC LIMIT ${e}
    `).map(r=>this.mapRow(r))}async getObservationsForSession(e){return(await this.sql`
      SELECT title, subtitle, type, prompt_number FROM observations
      WHERE memory_session_id = ${e}
      ORDER BY created_at_epoch ASC
    `).map(r=>({title:r.title||"",subtitle:r.subtitle||"",type:r.type,prompt_number:r.prompt_number}))}async getFilesForSession(e){let t=await this.sql`
      SELECT files_read, files_modified FROM observations
      WHERE memory_session_id = ${e}
    `,r=new Set,n=new Set;for(let o of t)try{let i=JSON.parse(o.files_read||"[]"),a=JSON.parse(o.files_modified||"[]");for(let d of i)r.add(d);for(let d of a)n.add(d)}catch{}return{filesRead:[...r],filesModified:[...n]}}async getObservationCount(e){if(e){let[r]=await this.sql`SELECT COUNT(*)::int as count FROM observations WHERE project = ${e}`;return r.count}let[t]=await this.sql`SELECT COUNT(*)::int as count FROM observations`;return t.count}computeContentHash(e){let t=[e.type,e.title,e.narrative,JSON.stringify(e.facts)].join("|");return(0,ln.createHash)("sha256").update(t).digest("hex").substring(0,16)}escapeStr(e){return e.replace(/'/g,"''")}mapRow(e){return{id:e.id,memory_session_id:e.memory_session_id,project:e.project,text:e.text,type:e.type,title:e.title||"",subtitle:e.subtitle||null,facts:e.facts||"[]",narrative:e.narrative||"",concepts:e.concepts||"[]",files_read:e.files_read||"[]",files_modified:e.files_modified||"[]",prompt_number:e.prompt_number,discovery_tokens:e.discovery_tokens??0,content_hash:e.content_hash||"",created_at:e.created_at instanceof Date?e.created_at.toISOString():String(e.created_at??""),created_at_epoch:Number(e.created_at_epoch)}}},At=class{constructor(e){this.sql=e}async storeSummary(e,t,r,n,o,i){let a=i??Date.now(),[d]=await this.sql`
      INSERT INTO session_summaries (
        memory_session_id, project, request, investigated, learned, completed,
        next_steps, notes, prompt_number, discovery_tokens, created_at_epoch
      ) VALUES (
        ${e}, ${t},
        ${r.request||null}, ${r.investigated||null},
        ${r.learned||null}, ${r.completed||null},
        ${r.next_steps||null},
        ${r.notes||null}, ${n??null},
        ${o??0}, ${a}
      )
      RETURNING id, created_at_epoch
    `;return{id:d.id,createdAtEpoch:Number(d.created_at_epoch)}}async getSummariesByIds(e,t){if(e.length===0)return[];let r=t?.orderBy==="date_asc"?"ASC":"DESC",n=[`id = ANY(ARRAY[${e.join(",")}])`];t?.project&&n.push(`project = '${t.project.replace(/'/g,"''")}'`);let o=t?.limit?`LIMIT ${t.limit}`:"";return(await this.sql.unsafe(`SELECT * FROM session_summaries WHERE ${n.join(" AND ")}
       ORDER BY created_at_epoch ${r} ${o}`)).map(a=>this.mapRow(a))}async getSummaryById(e){let[t]=await this.sql`SELECT * FROM session_summaries WHERE id = ${e}`;return t?this.mapRow(t):null}async getSummaryForSession(e){let[t]=await this.sql`
      SELECT * FROM session_summaries
      WHERE memory_session_id = ${e}
      ORDER BY created_at_epoch DESC LIMIT 1
    `;return t?this.mapRow(t):null}async getRecentSummaries(e,t=10){return(await this.sql`
      SELECT * FROM session_summaries WHERE project = ${e}
      ORDER BY created_at_epoch DESC LIMIT ${t}
    `).map(n=>this.mapRow(n))}async getRecentSummariesWithSessionInfo(e,t=10){return(await this.sql`
      SELECT memory_session_id, request, learned, completed, next_steps,
             prompt_number, created_at
      FROM session_summaries WHERE project = ${e}
      ORDER BY created_at_epoch DESC LIMIT ${t}
    `).map(n=>({memory_session_id:n.memory_session_id,request:n.request,learned:n.learned,completed:n.completed,next_steps:n.next_steps,prompt_number:n.prompt_number,created_at:n.created_at instanceof Date?n.created_at.toISOString():String(n.created_at??"")}))}async getAllRecentSummaries(e=10){return(await this.sql`
      SELECT * FROM session_summaries ORDER BY created_at_epoch DESC LIMIT ${e}
    `).map(r=>this.mapRow(r))}mapRow(e){return{id:e.id,memory_session_id:e.memory_session_id,project:e.project,request:e.request,investigated:e.investigated,learned:e.learned,completed:e.completed,next_steps:e.next_steps,files_read:e.files_read||"[]",files_edited:e.files_edited||"[]",notes:e.notes,prompt_number:e.prompt_number,discovery_tokens:e.discovery_tokens??0,created_at:e.created_at instanceof Date?e.created_at.toISOString():String(e.created_at??""),created_at_epoch:Number(e.created_at_epoch)}}},Ct=class{constructor(e){this.sql=e}async saveUserPrompt(e,t,r){let n=Date.now(),[o]=await this.sql`
      INSERT INTO user_prompts (content_session_id, prompt_number, prompt_text, created_at_epoch)
      VALUES (${e}, ${t}, ${r}, ${n})
      RETURNING id
    `;return o.id}async getPromptsByIds(e,t){if(e.length===0)return[];let r=t?.orderBy==="date_asc"?"ASC":"DESC",n=t?.limit?`LIMIT ${t.limit}`:"";return(await this.sql.unsafe(`SELECT p.*, s.project, s.memory_session_id
       FROM user_prompts p
       JOIN sdk_sessions s ON s.content_session_id = p.content_session_id
       WHERE p.id = ANY(ARRAY[${e.join(",")}])
       ORDER BY p.created_at_epoch ${r} ${n}`)).map(i=>this.mapRow(i))}async getPromptById(e){let[t]=await this.sql`
      SELECT p.*, s.project, s.memory_session_id
      FROM user_prompts p
      JOIN sdk_sessions s ON s.content_session_id = p.content_session_id
      WHERE p.id = ${e}
    `;return t?this.mapRow(t):null}async getUserPrompt(e,t){let[r]=await this.sql`
      SELECT prompt_text FROM user_prompts
      WHERE content_session_id = ${e} AND prompt_number = ${t}
    `;return r?.prompt_text??null}async getPromptCount(e){let[t]=await this.sql`
      SELECT COUNT(*)::int as count FROM user_prompts WHERE content_session_id = ${e}
    `;return t.count}async getLatestUserPrompt(e){let[t]=await this.sql`
      SELECT p.id, p.content_session_id, p.prompt_number, p.prompt_text,
             p.created_at, p.created_at_epoch, s.memory_session_id, s.project
      FROM user_prompts p
      JOIN sdk_sessions s ON s.content_session_id = p.content_session_id
      WHERE p.content_session_id = ${e}
      ORDER BY p.prompt_number DESC LIMIT 1
    `;return t?this.mapRow(t):null}async getAllRecentUserPrompts(e=50){return(await this.sql`
      SELECT p.*, s.project, s.memory_session_id
      FROM user_prompts p
      JOIN sdk_sessions s ON s.content_session_id = p.content_session_id
      ORDER BY p.created_at_epoch DESC LIMIT ${e}
    `).map(r=>this.mapRow(r))}mapRow(e){return{id:e.id,content_session_id:e.content_session_id,prompt_number:e.prompt_number,prompt_text:e.prompt_text,project:e.project||"",memory_session_id:e.memory_session_id||null,created_at:e.created_at instanceof Date?e.created_at.toISOString():String(e.created_at??""),created_at_epoch:Number(e.created_at_epoch)}}},Dt=class{constructor(e){this.sql=e}async enqueue(e,t,r){let n=Date.now(),[o]=await this.sql`
      INSERT INTO pending_messages (
        session_db_id, content_session_id, message_type, tool_name, tool_input,
        tool_response, cwd, last_assistant_message, prompt_number, created_at_epoch
      ) VALUES (
        ${e}, ${t}, ${r.type},
        ${r.tool_name||null}, ${r.tool_input||null},
        ${r.tool_response||null}, ${r.cwd||null},
        ${r.last_assistant_message||null}, ${r.prompt_number??null}, ${n}
      )
      RETURNING id
    `;return o.id}async claimNextMessage(e){let t=Date.now(),r=await this.sql`
      WITH next_msg AS (
        SELECT id FROM pending_messages
        WHERE session_db_id = ${e} AND status = 'pending'
        ORDER BY created_at_epoch ASC
        LIMIT 1
        FOR UPDATE SKIP LOCKED
      )
      UPDATE pending_messages
      SET status = 'processing', started_processing_at_epoch = ${t}
      WHERE id = (SELECT id FROM next_msg)
      RETURNING *
    `;return r.length===0?null:this.mapRow(r[0])}async confirmProcessed(e){await this.sql`
      UPDATE pending_messages
      SET status = 'processed', completed_at_epoch = ${Date.now()}
      WHERE id = ${e}
    `}async markFailed(e){await this.sql`
      UPDATE pending_messages
      SET status = 'failed', failed_at_epoch = ${Date.now()}, retry_count = retry_count + 1
      WHERE id = ${e}
    `}async getPendingCount(e){let[t]=await this.sql`
      SELECT COUNT(*)::int as count FROM pending_messages
      WHERE session_db_id = ${e} AND status IN ('pending', 'processing')
    `;return t.count}async getSessionsWithPendingMessages(){return(await this.sql`
      SELECT DISTINCT session_db_id FROM pending_messages
      WHERE status IN ('pending', 'processing')
    `).map(t=>t.session_db_id)}async resetStaleProcessingMessages(e=12e4,t){let r=Date.now()-e;return t!==void 0?(await this.sql`
        UPDATE pending_messages SET status = 'pending', started_processing_at_epoch = NULL
        WHERE status = 'processing' AND started_processing_at_epoch < ${r}
          AND session_db_id = ${t}
      `).count:(await this.sql`
      UPDATE pending_messages SET status = 'pending', started_processing_at_epoch = NULL
      WHERE status = 'processing' AND started_processing_at_epoch < ${r}
    `).count}async getQueueMessages(){return(await this.sql`
      SELECT pm.*, s.project
      FROM pending_messages pm
      LEFT JOIN sdk_sessions s ON s.id = pm.session_db_id
      ORDER BY pm.created_at_epoch DESC
    `).map(t=>({...this.mapRow(t),project:t.project||null}))}async hasAnyPendingWork(){let[e]=await this.sql`
      SELECT EXISTS(SELECT 1 FROM pending_messages WHERE status IN ('pending', 'processing')) as has_work
    `;return e.has_work}async getAllPending(e){return(await this.sql`
      SELECT * FROM pending_messages
      WHERE session_db_id = ${e} AND status IN ('pending', 'processing')
      ORDER BY created_at_epoch ASC
    `).map(r=>this.mapRow(r))}async resetProcessingToPending(e){return(await this.sql`
      UPDATE pending_messages SET status = 'pending', started_processing_at_epoch = NULL
      WHERE session_db_id = ${e} AND status = 'processing'
    `).count}async markSessionMessagesFailed(e){let t=Date.now();return(await this.sql`
      UPDATE pending_messages
      SET status = 'failed', failed_at_epoch = ${t}
      WHERE session_db_id = ${e} AND status IN ('pending', 'processing')
    `).count}async markAllSessionMessagesAbandoned(e){let t=Date.now();return(await this.sql`
      UPDATE pending_messages
      SET status = 'failed', failed_at_epoch = ${t}
      WHERE session_db_id = ${e} AND status IN ('pending', 'processing')
    `).count}toPendingMessage(e){return{type:e.message_type,tool_name:e.tool_name||void 0,tool_input:e.tool_input||void 0,tool_response:e.tool_response||void 0,cwd:e.cwd||void 0,last_assistant_message:e.last_assistant_message||void 0,prompt_number:e.prompt_number??void 0}}mapRow(e){return{id:e.id,session_db_id:e.session_db_id,content_session_id:e.content_session_id,message_type:e.message_type,tool_name:e.tool_name,tool_input:e.tool_input,tool_response:e.tool_response,cwd:e.cwd,last_assistant_message:e.last_assistant_message,prompt_number:e.prompt_number,status:e.status,retry_count:e.retry_count,created_at_epoch:Number(e.created_at_epoch),started_processing_at_epoch:e.started_processing_at_epoch?Number(e.started_processing_at_epoch):null,completed_at_epoch:e.completed_at_epoch?Number(e.completed_at_epoch):null,failed_at_epoch:e.failed_at_epoch?Number(e.failed_at_epoch):null}}},vt=class{constructor(e){this.sql=e}async getTimelineAroundObservation(e,t,r=10,n=10,o){let i=t,a=t,d=o?await this.sql`
          SELECT * FROM observations WHERE created_at_epoch <= ${i} AND project = ${o}
          ORDER BY created_at_epoch DESC LIMIT ${r}
        `:await this.sql`
          SELECT * FROM observations WHERE created_at_epoch <= ${i}
          ORDER BY created_at_epoch DESC LIMIT ${r}
        `,m=o?await this.sql`
          SELECT * FROM observations WHERE created_at_epoch > ${a} AND project = ${o}
          ORDER BY created_at_epoch ASC LIMIT ${n}
        `:await this.sql`
          SELECT * FROM observations WHERE created_at_epoch > ${a}
          ORDER BY created_at_epoch ASC LIMIT ${n}
        `,l=[...d.reverse(),...m];if(l.length===0)return{observations:[],sessions:[],prompts:[]};let g=Math.min(...l.map(_=>Number(_.created_at_epoch))),h=Math.max(...l.map(_=>Number(_.created_at_epoch))),p=o?await this.sql`
          SELECT ss.id, ss.memory_session_id, ss.project, ss.request, ss.completed,
                 ss.next_steps, ss.created_at, ss.created_at_epoch
          FROM session_summaries ss
          WHERE ss.created_at_epoch BETWEEN ${g} AND ${h} AND ss.project = ${o}
          ORDER BY ss.created_at_epoch DESC
        `:await this.sql`
          SELECT ss.id, ss.memory_session_id, ss.project, ss.request, ss.completed,
                 ss.next_steps, ss.created_at, ss.created_at_epoch
          FROM session_summaries ss
          WHERE ss.created_at_epoch BETWEEN ${g} AND ${h}
          ORDER BY ss.created_at_epoch DESC
        `,y=o?await this.sql`
          SELECT p.id, p.content_session_id, p.prompt_number, p.prompt_text,
                 s.project, p.created_at, p.created_at_epoch
          FROM user_prompts p
          JOIN sdk_sessions s ON s.content_session_id = p.content_session_id
          WHERE p.created_at_epoch BETWEEN ${g} AND ${h} AND s.project = ${o}
          ORDER BY p.created_at_epoch DESC
        `:await this.sql`
          SELECT p.id, p.content_session_id, p.prompt_number, p.prompt_text,
                 s.project, p.created_at, p.created_at_epoch
          FROM user_prompts p
          JOIN sdk_sessions s ON s.content_session_id = p.content_session_id
          WHERE p.created_at_epoch BETWEEN ${g} AND ${h}
          ORDER BY p.created_at_epoch DESC
        `;return{observations:l.map(_=>this.mapObservation(_)),sessions:p.map(_=>({id:_.id,memory_session_id:_.memory_session_id,project:_.project,request:_.request,completed:_.completed,next_steps:_.next_steps,created_at:_.created_at instanceof Date?_.created_at.toISOString():String(_.created_at??""),created_at_epoch:Number(_.created_at_epoch)})),prompts:y.map(_=>({id:_.id,content_session_id:_.content_session_id,prompt_number:_.prompt_number,prompt_text:_.prompt_text,project:_.project,created_at:_.created_at instanceof Date?_.created_at.toISOString():String(_.created_at??""),created_at_epoch:Number(_.created_at_epoch)}))}}async getTimelineByTimeRange(e,t,r){let n=r?await this.sql`
          SELECT * FROM observations
          WHERE created_at_epoch BETWEEN ${e} AND ${t} AND project = ${r}
          ORDER BY created_at_epoch DESC
        `:await this.sql`
          SELECT * FROM observations
          WHERE created_at_epoch BETWEEN ${e} AND ${t}
          ORDER BY created_at_epoch DESC
        `,o=r?await this.sql`
          SELECT ss.id, ss.memory_session_id, ss.project, ss.request, ss.completed,
                 ss.next_steps, ss.created_at, ss.created_at_epoch
          FROM session_summaries ss
          WHERE ss.created_at_epoch BETWEEN ${e} AND ${t} AND ss.project = ${r}
          ORDER BY ss.created_at_epoch DESC
        `:await this.sql`
          SELECT ss.id, ss.memory_session_id, ss.project, ss.request, ss.completed,
                 ss.next_steps, ss.created_at, ss.created_at_epoch
          FROM session_summaries ss
          WHERE ss.created_at_epoch BETWEEN ${e} AND ${t}
          ORDER BY ss.created_at_epoch DESC
        `,i=r?await this.sql`
          SELECT p.id, p.content_session_id, p.prompt_number, p.prompt_text,
                 s.project, p.created_at, p.created_at_epoch
          FROM user_prompts p
          JOIN sdk_sessions s ON s.content_session_id = p.content_session_id
          WHERE p.created_at_epoch BETWEEN ${e} AND ${t} AND s.project = ${r}
          ORDER BY p.created_at_epoch DESC
        `:await this.sql`
          SELECT p.id, p.content_session_id, p.prompt_number, p.prompt_text,
                 s.project, p.created_at, p.created_at_epoch
          FROM user_prompts p
          JOIN sdk_sessions s ON s.content_session_id = p.content_session_id
          WHERE p.created_at_epoch BETWEEN ${e} AND ${t}
          ORDER BY p.created_at_epoch DESC
        `;return{observations:n.map(a=>this.mapObservation(a)),sessions:o.map(a=>({id:a.id,memory_session_id:a.memory_session_id,project:a.project,request:a.request,completed:a.completed,next_steps:a.next_steps,created_at:a.created_at instanceof Date?a.created_at.toISOString():String(a.created_at??""),created_at_epoch:Number(a.created_at_epoch)})),prompts:i.map(a=>({id:a.id,content_session_id:a.content_session_id,prompt_number:a.prompt_number,prompt_text:a.prompt_text,project:a.project,created_at:a.created_at instanceof Date?a.created_at.toISOString():String(a.created_at??""),created_at_epoch:Number(a.created_at_epoch)}))}}mapObservation(e){return{id:e.id,memory_session_id:e.memory_session_id,project:e.project,text:e.text,type:e.type,title:e.title||"",subtitle:e.subtitle||null,facts:e.facts||"[]",narrative:e.narrative||"",concepts:e.concepts||"[]",files_read:e.files_read||"[]",files_modified:e.files_modified||"[]",prompt_number:e.prompt_number,discovery_tokens:e.discovery_tokens??0,content_hash:e.content_hash||"",created_at:e.created_at instanceof Date?e.created_at.toISOString():String(e.created_at??""),created_at_epoch:Number(e.created_at_epoch)}}},Lt=class{constructor(e){this.sql=e}async fullTextSearch(e){let{query:t,project:r,limit:n=50}=e,o=e.tables||["observations","summaries","prompts"],i=[];if(o.includes("observations")){let a=r?await this.sql`
            SELECT id, ts_rank(search_vector, plainto_tsquery('english', ${t})) as score
            FROM observations
            WHERE search_vector @@ plainto_tsquery('english', ${t}) AND project = ${r}
            ORDER BY score DESC LIMIT ${n}
          `:await this.sql`
            SELECT id, ts_rank(search_vector, plainto_tsquery('english', ${t})) as score
            FROM observations
            WHERE search_vector @@ plainto_tsquery('english', ${t})
            ORDER BY score DESC LIMIT ${n}
          `;for(let d of a)i.push({id:d.id,table:"observations",score:d.score,project:r||""})}if(o.includes("summaries")){let a=r?await this.sql`
            SELECT id, ts_rank(search_vector, plainto_tsquery('english', ${t})) as score
            FROM session_summaries
            WHERE search_vector @@ plainto_tsquery('english', ${t}) AND project = ${r}
            ORDER BY score DESC LIMIT ${n}
          `:await this.sql`
            SELECT id, ts_rank(search_vector, plainto_tsquery('english', ${t})) as score
            FROM session_summaries
            WHERE search_vector @@ plainto_tsquery('english', ${t})
            ORDER BY score DESC LIMIT ${n}
          `;for(let d of a)i.push({id:d.id,table:"summaries",score:d.score,project:r||""})}if(o.includes("prompts")){let a=r?await this.sql`
            SELECT p.id, ts_rank(p.search_vector, plainto_tsquery('english', ${t})) as score
            FROM user_prompts p
            JOIN sdk_sessions s ON s.content_session_id = p.content_session_id
            WHERE p.search_vector @@ plainto_tsquery('english', ${t}) AND s.project = ${r}
            ORDER BY score DESC LIMIT ${n}
          `:await this.sql`
            SELECT id, ts_rank(search_vector, plainto_tsquery('english', ${t})) as score
            FROM user_prompts
            WHERE search_vector @@ plainto_tsquery('english', ${t})
            ORDER BY score DESC LIMIT ${n}
          `;for(let d of a)i.push({id:d.id,table:"prompts",score:d.score,project:r||""})}return i.sort((a,d)=>d.score-a.score).slice(0,n)}async vectorSearch(e){let{queryVector:t,project:r,limit:n=20}=e,o=e.tables||["observations","summaries","prompts"],i=[],a=`[${t.join(",")}]`;if(o.includes("observations")){let d=r?await this.sql.unsafe(`SELECT id, embedding <=> '${a}' as distance
             FROM observations
             WHERE embedding IS NOT NULL AND project = $1
             ORDER BY distance ASC LIMIT $2`,[r,n]):await this.sql.unsafe(`SELECT id, embedding <=> '${a}' as distance
             FROM observations
             WHERE embedding IS NOT NULL
             ORDER BY distance ASC LIMIT $1`,[n]);for(let m of d)i.push({id:m.id,table:"observations",score:1-m.distance,distance:m.distance,project:r||""})}if(o.includes("summaries")){let d=r?await this.sql.unsafe(`SELECT id, embedding <=> '${a}' as distance
             FROM session_summaries
             WHERE embedding IS NOT NULL AND project = $1
             ORDER BY distance ASC LIMIT $2`,[r,n]):await this.sql.unsafe(`SELECT id, embedding <=> '${a}' as distance
             FROM session_summaries
             WHERE embedding IS NOT NULL
             ORDER BY distance ASC LIMIT $1`,[n]);for(let m of d)i.push({id:m.id,table:"summaries",score:1-m.distance,distance:m.distance,project:r||""})}if(o.includes("prompts")){let d=r?await this.sql.unsafe(`SELECT p.id, p.embedding <=> '${a}' as distance
             FROM user_prompts p
             JOIN sdk_sessions s ON s.content_session_id = p.content_session_id
             WHERE p.embedding IS NOT NULL AND s.project = $1
             ORDER BY distance ASC LIMIT $2`,[r,n]):await this.sql.unsafe(`SELECT id, embedding <=> '${a}' as distance
             FROM user_prompts
             WHERE embedding IS NOT NULL
             ORDER BY distance ASC LIMIT $1`,[n]);for(let m of d)i.push({id:m.id,table:"prompts",score:1-m.distance,distance:m.distance,project:r||""})}return i.sort((d,m)=>d.distance-m.distance).slice(0,n)}async filterSearch(e){let{project:t,limit:r=50,offset:n=0,searchType:o="all"}=e,i=e.orderBy==="date_asc"?"ASC":"DESC",a=[],d=[],m=[];if(o==="observations"||o==="all"){let l=[];t&&l.push(`project = '${t.replace(/'/g,"''")}'`),e.types?.length&&l.push(`type = ANY(ARRAY[${e.types.map(p=>`'${p.replace(/'/g,"''")}'`).join(",")}])`),e.dateRange&&(l.push(`created_at_epoch >= ${e.dateRange.start}`),l.push(`created_at_epoch <= ${e.dateRange.end}`));let g=l.length>0?`WHERE ${l.join(" AND ")}`:"";a=(await this.sql.unsafe(`SELECT * FROM observations ${g}
         ORDER BY created_at_epoch ${i} LIMIT ${r} OFFSET ${n}`)).map(p=>({id:p.id,memory_session_id:p.memory_session_id,project:p.project,text:p.text,type:p.type,title:p.title||"",subtitle:p.subtitle||null,facts:p.facts||"[]",narrative:p.narrative||"",concepts:p.concepts||"[]",files_read:p.files_read||"[]",files_modified:p.files_modified||"[]",prompt_number:p.prompt_number,discovery_tokens:p.discovery_tokens??0,content_hash:p.content_hash||"",created_at:p.created_at instanceof Date?p.created_at.toISOString():String(p.created_at??""),created_at_epoch:Number(p.created_at_epoch)}))}if(o==="sessions"||o==="all"){let l=[];t&&l.push(`project = '${t.replace(/'/g,"''")}'`),e.dateRange&&(l.push(`created_at_epoch >= ${e.dateRange.start}`),l.push(`created_at_epoch <= ${e.dateRange.end}`));let g=l.length>0?`WHERE ${l.join(" AND ")}`:"";d=(await this.sql.unsafe(`SELECT * FROM session_summaries ${g}
         ORDER BY created_at_epoch ${i} LIMIT ${r} OFFSET ${n}`)).map(p=>({id:p.id,memory_session_id:p.memory_session_id,project:p.project,request:p.request,investigated:p.investigated,learned:p.learned,completed:p.completed,next_steps:p.next_steps,files_read:p.files_read||"[]",files_edited:p.files_edited||"[]",notes:p.notes,prompt_number:p.prompt_number,discovery_tokens:p.discovery_tokens??0,created_at:p.created_at instanceof Date?p.created_at.toISOString():String(p.created_at??""),created_at_epoch:Number(p.created_at_epoch)}))}if(o==="prompts"||o==="all"){let l=[];t&&l.push(`s.project = '${t.replace(/'/g,"''")}'`),e.dateRange&&(l.push(`p.created_at_epoch >= ${e.dateRange.start}`),l.push(`p.created_at_epoch <= ${e.dateRange.end}`));let g=l.length>0?`WHERE ${l.join(" AND ")}`:"";m=(await this.sql.unsafe(`SELECT p.*, s.project, s.memory_session_id FROM user_prompts p
         JOIN sdk_sessions s ON s.content_session_id = p.content_session_id
         ${g}
         ORDER BY p.created_at_epoch ${i} LIMIT ${r} OFFSET ${n}`)).map(p=>({id:p.id,content_session_id:p.content_session_id,prompt_number:p.prompt_number,prompt_text:p.prompt_text,project:p.project||"",memory_session_id:p.memory_session_id||null,created_at:p.created_at instanceof Date?p.created_at.toISOString():String(p.created_at??""),created_at_epoch:Number(p.created_at_epoch)}))}return{observations:a,sessions:d,prompts:m}}},Ns=class s{constructor(e){this.sql=e;this.sessions=new Nt(e),this.observations=new It(e),this.summaries=new At(e),this.prompts=new Ct(e),this.pendingMessages=new Dt(e),this.timeline=new vt(e),this.search=new Lt(e)}sessions;observations;summaries;prompts;pendingMessages;timeline;search;providerName="postgresql";static async create(e){let t=(await Promise.resolve().then(()=>(mn(),pn))).default,r={max:e.poolMax,idle_timeout:30,connect_timeout:10},n;e.connectionString?n=t(e.connectionString,r):n=t({host:e.host,port:e.port,database:e.database,username:e.username,password:e.password,ssl:e.ssl,...r});try{await n`SELECT 1`}catch(i){throw await n.end(),i}return await new pt(n).runAllMigrations(),new s(n)}async withTransaction(e){return this.sql.begin(async t=>{let r={sessions:new Nt(t),observations:new It(t),summaries:new At(t),prompts:new Ct(t),pendingMessages:new Dt(t),timeline:new vt(t),search:new Lt(t),providerName:"postgresql",withTransaction:()=>{throw new Error("Nested transactions not supported")},close:()=>Promise.resolve(),isHealthy:()=>Promise.resolve(!0)};return e(r)})}async close(){await this.sql.end(),S.info("DB","PostgreSQL connection pool closed")}async isHealthy(){try{return await this.sql`SELECT 1`,!0}catch{return!1}}}});var na={};it(na,{generateContext:()=>Us});module.exports=Ys(na);var lo=me(require("path"),1),_o=require("os"),Eo=require("fs");oe();var Js=me(require("path"),1);oe();function Qs(s){if(!s||s.trim()==="")return S.warn("PROJECT_NAME","Empty cwd provided, using fallback",{cwd:s}),"unknown-project";let e=Js.default.basename(s);if(e===""){if(process.platform==="win32"){let r=s.match(/^([A-Z]):\\/i);if(r){let o=`drive-${r[1].toUpperCase()}`;return S.info("PROJECT_NAME","Drive root detected",{cwd:s,projectName:o}),o}}return S.warn("PROJECT_NAME","Root directory detected, using fallback",{cwd:s}),"unknown-project"}return e}ct();ke();function pr(s,e,t,r,n){let o=new Date,i=o.getTime(),a=s.prepare(`
    SELECT id FROM sdk_sessions WHERE content_session_id = ?
  `).get(e);return a?(t&&s.prepare(`
        UPDATE sdk_sessions SET project = ?
        WHERE content_session_id = ? AND (project IS NULL OR project = '')
      `).run(t,e),n&&s.prepare(`
        UPDATE sdk_sessions SET custom_title = ?
        WHERE content_session_id = ? AND custom_title IS NULL
      `).run(n,e),a.id):(s.prepare(`
    INSERT INTO sdk_sessions
    (content_session_id, memory_session_id, project, user_prompt, custom_title, started_at, started_at_epoch, status)
    VALUES (?, NULL, ?, ?, ?, ?, ?, 'active')
  `).run(e,t,r,n||null,o.toISOString(),i),s.prepare("SELECT id FROM sdk_sessions WHERE content_session_id = ?").get(e).id)}function mr(s,e,t){s.prepare(`
    UPDATE sdk_sessions
    SET memory_session_id = ?
    WHERE id = ?
  `).run(t,e)}function lr(s,e){return s.prepare(`
    SELECT id, content_session_id, memory_session_id, project, user_prompt, custom_title
    FROM sdk_sessions
    WHERE id = ?
    LIMIT 1
  `).get(e)||null}function _r(s,e){if(e.length===0)return[];let t=e.map(()=>"?").join(",");return s.prepare(`
    SELECT id, content_session_id, memory_session_id, project, user_prompt, custom_title,
           started_at, started_at_epoch, completed_at, completed_at_epoch, status
    FROM sdk_sessions
    WHERE memory_session_id IN (${t})
    ORDER BY started_at_epoch DESC
  `).all(...e)}function Er(s,e,t=3){return s.prepare(`
    SELECT * FROM (
      SELECT
        s.memory_session_id,
        s.status,
        s.started_at,
        s.started_at_epoch,
        s.user_prompt,
        CASE WHEN sum.memory_session_id IS NOT NULL THEN 1 ELSE 0 END as has_summary
      FROM sdk_sessions s
      LEFT JOIN session_summaries sum ON s.memory_session_id = sum.memory_session_id
      WHERE s.project = ? AND s.memory_session_id IS NOT NULL
      GROUP BY s.memory_session_id
      ORDER BY s.started_at_epoch DESC
      LIMIT ?
    )
    ORDER BY started_at_epoch ASC
  `).all(e,t)}Vt();function fr(s,e){return s.prepare(`
    SELECT *
    FROM observations
    WHERE id = ?
  `).get(e)||null}function Tr(s,e,t={}){if(e.length===0)return[];let{orderBy:r="date_desc",limit:n,project:o,type:i,concepts:a,files:d}=t,m=r==="date_asc"?"ASC":"DESC",l=n?`LIMIT ${n}`:"",g=e.map(()=>"?").join(","),h=[...e],p=[];if(o&&(p.push("project = ?"),h.push(o)),i)if(Array.isArray(i)){let f=i.map(()=>"?").join(",");p.push(`type IN (${f})`),h.push(...i)}else p.push("type = ?"),h.push(i);if(a){let f=Array.isArray(a)?a:[a],O=f.map(()=>"EXISTS (SELECT 1 FROM json_each(concepts) WHERE value = ?)");h.push(...f),p.push(`(${O.join(" OR ")})`)}if(d){let f=Array.isArray(d)?d:[d],O=f.map(()=>"(EXISTS (SELECT 1 FROM json_each(files_read) WHERE value LIKE ?) OR EXISTS (SELECT 1 FROM json_each(files_modified) WHERE value LIKE ?))");f.forEach(A=>{h.push(`%${A}%`,`%${A}%`)}),p.push(`(${O.join(" OR ")})`)}let y=p.length>0?`WHERE id IN (${g}) AND ${p.join(" AND ")}`:`WHERE id IN (${g})`;return s.prepare(`
    SELECT *
    FROM observations
    ${y}
    ORDER BY created_at_epoch ${m}
    ${l}
  `).all(...h)}function Sr(s,e){return s.prepare(`
    SELECT title, subtitle, type, prompt_number
    FROM observations
    WHERE memory_session_id = ?
    ORDER BY created_at_epoch ASC
  `).all(e)}function br(s,e){let r=s.prepare(`
    SELECT files_read, files_modified
    FROM observations
    WHERE memory_session_id = ?
  `).all(e),n=new Set,o=new Set;for(let i of r){if(i.files_read){let a=JSON.parse(i.files_read);Array.isArray(a)&&a.forEach(d=>n.add(d))}if(i.files_modified){let a=JSON.parse(i.files_modified);Array.isArray(a)&&a.forEach(d=>o.add(d))}}return{filesRead:Array.from(n),filesModified:Array.from(o)}}function Rr(s,e,t,r,n,o=0,i){let a=i??Date.now(),d=new Date(a).toISOString(),l=s.prepare(`
    INSERT INTO session_summaries
    (memory_session_id, project, request, investigated, learned, completed,
     next_steps, notes, prompt_number, discovery_tokens, created_at, created_at_epoch)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(e,t,r.request,r.investigated,r.learned,r.completed,r.next_steps,r.notes,n||null,o,d,a);return{id:Number(l.lastInsertRowid),createdAtEpoch:a}}function yr(s,e){return s.prepare(`
    SELECT
      request, investigated, learned, completed, next_steps,
      files_read, files_edited, notes, prompt_number, created_at,
      created_at_epoch
    FROM session_summaries
    WHERE memory_session_id = ?
    ORDER BY created_at_epoch DESC
    LIMIT 1
  `).get(e)||null}function Or(s,e){return s.prepare(`
    SELECT * FROM session_summaries WHERE id = ?
  `).get(e)||null}function Nr(s,e,t={}){if(e.length===0)return[];let{orderBy:r="date_desc",limit:n,project:o}=t,i=r==="date_asc"?"ASC":"DESC",a=n?`LIMIT ${n}`:"",d=e.map(()=>"?").join(","),m=[...e],l=o?`WHERE id IN (${d}) AND project = ?`:`WHERE id IN (${d})`;return o&&m.push(o),s.prepare(`
    SELECT * FROM session_summaries
    ${l}
    ORDER BY created_at_epoch ${i}
    ${a}
  `).all(...m)}function Ir(s,e,t=3){return s.prepare(`
    SELECT
      memory_session_id, request, learned, completed, next_steps,
      prompt_number, created_at
    FROM session_summaries
    WHERE project = ?
    ORDER BY created_at_epoch DESC
    LIMIT ?
  `).all(e,t)}function Ar(s,e,t,r){let n=new Date,o=n.getTime();return s.prepare(`
    INSERT INTO user_prompts
    (content_session_id, prompt_number, prompt_text, created_at, created_at_epoch)
    VALUES (?, ?, ?, ?, ?)
  `).run(e,t,r,n.toISOString(),o).lastInsertRowid}function Cr(s,e,t){return s.prepare(`
    SELECT prompt_text
    FROM user_prompts
    WHERE content_session_id = ? AND prompt_number = ?
    LIMIT 1
  `).get(e,t)?.prompt_text??null}function Dr(s,e){return s.prepare(`
    SELECT COUNT(*) as count FROM user_prompts WHERE content_session_id = ?
  `).get(e).count}function vr(s,e){return s.prepare(`
    SELECT
      up.*,
      s.memory_session_id,
      s.project
    FROM user_prompts up
    JOIN sdk_sessions s ON up.content_session_id = s.content_session_id
    WHERE up.content_session_id = ?
    ORDER BY up.created_at_epoch DESC
    LIMIT 1
  `).get(e)}function Lr(s,e=100){return s.prepare(`
    SELECT
      up.id,
      up.content_session_id,
      s.project,
      up.prompt_number,
      up.prompt_text,
      up.created_at,
      up.created_at_epoch
    FROM user_prompts up
    LEFT JOIN sdk_sessions s ON up.content_session_id = s.content_session_id
    ORDER BY up.created_at_epoch DESC
    LIMIT ?
  `).all(e)}function Mr(s,e){return s.prepare(`
    SELECT
      p.id,
      p.content_session_id,
      p.prompt_number,
      p.prompt_text,
      s.project,
      p.created_at,
      p.created_at_epoch
    FROM user_prompts p
    LEFT JOIN sdk_sessions s ON p.content_session_id = s.content_session_id
    WHERE p.id = ?
    LIMIT 1
  `).get(e)||null}function wr(s,e,t={}){if(e.length===0)return[];let{orderBy:r="date_desc",limit:n,project:o}=t,i=r==="date_asc"?"ASC":"DESC",a=n?`LIMIT ${n}`:"",d=e.map(()=>"?").join(","),m=[...e],l=o?"AND s.project = ?":"";return o&&m.push(o),s.prepare(`
    SELECT
      up.*,
      s.project,
      s.memory_session_id
    FROM user_prompts up
    JOIN sdk_sessions s ON up.content_session_id = s.content_session_id
    WHERE up.id IN (${d}) ${l}
    ORDER BY up.created_at_epoch ${i}
    ${a}
  `).all(...m)}oe();function Kt(s,e,t,r=10,n=10,o){let i=o?"AND project = ?":"",a=o?[o]:[],d,m;if(e!==null){let f=`
      SELECT id, created_at_epoch
      FROM observations
      WHERE id <= ? ${i}
      ORDER BY id DESC
      LIMIT ?
    `,O=`
      SELECT id, created_at_epoch
      FROM observations
      WHERE id >= ? ${i}
      ORDER BY id ASC
      LIMIT ?
    `;try{let A=s.prepare(f).all(e,...a,r+1),v=s.prepare(O).all(e,...a,n+1);if(A.length===0&&v.length===0)return{observations:[],sessions:[],prompts:[]};d=A.length>0?A[A.length-1].created_at_epoch:t,m=v.length>0?v[v.length-1].created_at_epoch:t}catch(A){return S.error("DB","Error getting boundary observations",void 0,{error:A,project:o}),{observations:[],sessions:[],prompts:[]}}}else{let f=`
      SELECT created_at_epoch
      FROM observations
      WHERE created_at_epoch <= ? ${i}
      ORDER BY created_at_epoch DESC
      LIMIT ?
    `,O=`
      SELECT created_at_epoch
      FROM observations
      WHERE created_at_epoch >= ? ${i}
      ORDER BY created_at_epoch ASC
      LIMIT ?
    `;try{let A=s.prepare(f).all(t,...a,r),v=s.prepare(O).all(t,...a,n+1);if(A.length===0&&v.length===0)return{observations:[],sessions:[],prompts:[]};d=A.length>0?A[A.length-1].created_at_epoch:t,m=v.length>0?v[v.length-1].created_at_epoch:t}catch(A){return S.error("DB","Error getting boundary timestamps",void 0,{error:A,project:o}),{observations:[],sessions:[],prompts:[]}}}let l=`
    SELECT *
    FROM observations
    WHERE created_at_epoch >= ? AND created_at_epoch <= ? ${i}
    ORDER BY created_at_epoch ASC
  `,g=`
    SELECT *
    FROM session_summaries
    WHERE created_at_epoch >= ? AND created_at_epoch <= ? ${i}
    ORDER BY created_at_epoch ASC
  `,h=`
    SELECT up.*, s.project, s.memory_session_id
    FROM user_prompts up
    JOIN sdk_sessions s ON up.content_session_id = s.content_session_id
    WHERE up.created_at_epoch >= ? AND up.created_at_epoch <= ? ${i.replace("project","s.project")}
    ORDER BY up.created_at_epoch ASC
  `,p=s.prepare(l).all(d,m,...a),y=s.prepare(g).all(d,m,...a),_=s.prepare(h).all(d,m,...a);return{observations:p,sessions:y.map(f=>({id:f.id,memory_session_id:f.memory_session_id,project:f.project,request:f.request,completed:f.completed,next_steps:f.next_steps,created_at:f.created_at,created_at_epoch:f.created_at_epoch})),prompts:_.map(f=>({id:f.id,content_session_id:f.content_session_id,prompt_number:f.prompt_number,prompt_text:f.prompt_text,project:f.project,created_at:f.created_at,created_at_epoch:f.created_at_epoch}))}}function Pr(s){return s.prepare(`
    SELECT DISTINCT project
    FROM sdk_sessions
    WHERE project IS NOT NULL AND project != ''
    ORDER BY project ASC
  `).all().map(r=>r.project)}oe();var hi=6e4,dt=class{db;maxRetries;constructor(e,t=3){this.db=e,this.maxRetries=t}enqueue(e,t,r){let n=Date.now();return this.db.prepare(`
      INSERT INTO pending_messages (
        session_db_id, content_session_id, message_type,
        tool_name, tool_input, tool_response, cwd,
        last_assistant_message,
        prompt_number, status, retry_count, created_at_epoch
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending', 0, ?)
    `).run(e,t,r.type,r.tool_name||null,r.tool_input?JSON.stringify(r.tool_input):null,r.tool_response?JSON.stringify(r.tool_response):null,r.cwd||null,r.last_assistant_message||null,r.prompt_number||null,n).lastInsertRowid}claimNextMessage(e){return this.db.transaction(r=>{let n=Date.now(),o=n-hi,a=this.db.prepare(`
        UPDATE pending_messages
        SET status = 'pending', started_processing_at_epoch = NULL
        WHERE session_db_id = ? AND status = 'processing'
          AND started_processing_at_epoch < ?
      `).run(r,o);a.changes>0&&S.info("QUEUE",`SELF_HEAL | sessionDbId=${r} | recovered ${a.changes} stale processing message(s)`);let m=this.db.prepare(`
        SELECT * FROM pending_messages
        WHERE session_db_id = ? AND status = 'pending'
        ORDER BY id ASC
        LIMIT 1
      `).get(r);return m&&(this.db.prepare(`
          UPDATE pending_messages
          SET status = 'processing', started_processing_at_epoch = ?
          WHERE id = ?
        `).run(n,m.id),S.info("QUEUE",`CLAIMED | sessionDbId=${r} | messageId=${m.id} | type=${m.message_type}`,{sessionId:r})),m})(e)}confirmProcessed(e){this.db.prepare("DELETE FROM pending_messages WHERE id = ?").run(e).changes>0&&S.debug("QUEUE",`CONFIRMED | messageId=${e} | deleted from queue`)}resetStaleProcessingMessages(e=300*1e3,t){let r=Date.now()-e,n,o;return t!==void 0?(n=this.db.prepare(`
        UPDATE pending_messages
        SET status = 'pending', started_processing_at_epoch = NULL
        WHERE status = 'processing' AND started_processing_at_epoch < ? AND session_db_id = ?
      `),o=n.run(r,t)):(n=this.db.prepare(`
        UPDATE pending_messages
        SET status = 'pending', started_processing_at_epoch = NULL
        WHERE status = 'processing' AND started_processing_at_epoch < ?
      `),o=n.run(r)),o.changes>0&&S.info("QUEUE",`RESET_STALE | count=${o.changes} | thresholdMs=${e}${t!==void 0?` | sessionDbId=${t}`:""}`),o.changes}getAllPending(e){return this.db.prepare(`
      SELECT * FROM pending_messages
      WHERE session_db_id = ? AND status = 'pending'
      ORDER BY id ASC
    `).all(e)}getQueueMessages(){return this.db.prepare(`
      SELECT pm.*, ss.project
      FROM pending_messages pm
      LEFT JOIN sdk_sessions ss ON pm.content_session_id = ss.content_session_id
      WHERE pm.status IN ('pending', 'processing', 'failed')
      ORDER BY
        CASE pm.status
          WHEN 'failed' THEN 0
          WHEN 'processing' THEN 1
          WHEN 'pending' THEN 2
        END,
        pm.created_at_epoch ASC
    `).all()}getStuckCount(e){let t=Date.now()-e;return this.db.prepare(`
      SELECT COUNT(*) as count FROM pending_messages
      WHERE status = 'processing' AND started_processing_at_epoch < ?
    `).get(t).count}retryMessage(e){return this.db.prepare(`
      UPDATE pending_messages
      SET status = 'pending', started_processing_at_epoch = NULL
      WHERE id = ? AND status IN ('pending', 'processing', 'failed')
    `).run(e).changes>0}resetProcessingToPending(e){return this.db.prepare(`
      UPDATE pending_messages
      SET status = 'pending', started_processing_at_epoch = NULL
      WHERE session_db_id = ? AND status = 'processing'
    `).run(e).changes}markSessionMessagesFailed(e){let t=Date.now();return this.db.prepare(`
      UPDATE pending_messages
      SET status = 'failed', failed_at_epoch = ?
      WHERE session_db_id = ? AND status = 'processing'
    `).run(t,e).changes}markAllSessionMessagesAbandoned(e){let t=Date.now();return this.db.prepare(`
      UPDATE pending_messages
      SET status = 'failed', failed_at_epoch = ?
      WHERE session_db_id = ? AND status IN ('pending', 'processing')
    `).run(t,e).changes}abortMessage(e){return this.db.prepare("DELETE FROM pending_messages WHERE id = ?").run(e).changes>0}retryAllStuck(e){let t=Date.now()-e;return this.db.prepare(`
      UPDATE pending_messages
      SET status = 'pending', started_processing_at_epoch = NULL
      WHERE status = 'processing' AND started_processing_at_epoch < ?
    `).run(t).changes}getRecentlyProcessed(e=10,t=30){let r=Date.now()-t*60*1e3;return this.db.prepare(`
      SELECT pm.*, ss.project
      FROM pending_messages pm
      LEFT JOIN sdk_sessions ss ON pm.content_session_id = ss.content_session_id
      WHERE pm.status = 'processed' AND pm.completed_at_epoch > ?
      ORDER BY pm.completed_at_epoch DESC
      LIMIT ?
    `).all(r,e)}markFailed(e){let t=Date.now(),r=this.db.prepare("SELECT retry_count FROM pending_messages WHERE id = ?").get(e);r&&(r.retry_count<this.maxRetries?this.db.prepare(`
        UPDATE pending_messages
        SET status = 'pending', retry_count = retry_count + 1, started_processing_at_epoch = NULL
        WHERE id = ?
      `).run(e):this.db.prepare(`
        UPDATE pending_messages
        SET status = 'failed', completed_at_epoch = ?
        WHERE id = ?
      `).run(t,e))}resetStuckMessages(e){let t=e===0?Date.now():Date.now()-e;return this.db.prepare(`
      UPDATE pending_messages
      SET status = 'pending', started_processing_at_epoch = NULL
      WHERE status = 'processing' AND started_processing_at_epoch < ?
    `).run(t).changes}getPendingCount(e){return this.db.prepare(`
      SELECT COUNT(*) as count FROM pending_messages
      WHERE session_db_id = ? AND status IN ('pending', 'processing')
    `).get(e).count}hasAnyPendingWork(){let e=Date.now()-3e5,r=this.db.prepare(`
      UPDATE pending_messages
      SET status = 'pending', started_processing_at_epoch = NULL
      WHERE status = 'processing' AND started_processing_at_epoch < ?
    `).run(e);return r.changes>0&&S.info("QUEUE",`STUCK_RESET | hasAnyPendingWork reset ${r.changes} stuck processing message(s) older than 5 minutes`),this.db.prepare(`
      SELECT COUNT(*) as count FROM pending_messages
      WHERE status IN ('pending', 'processing')
    `).get().count>0}getSessionsWithPendingMessages(){return this.db.prepare(`
      SELECT DISTINCT session_db_id FROM pending_messages
      WHERE status IN ('pending', 'processing')
    `).all().map(r=>r.session_db_id)}getSessionInfoForMessage(e){let r=this.db.prepare(`
      SELECT session_db_id, content_session_id FROM pending_messages WHERE id = ?
    `).get(e);return r?{sessionDbId:r.session_db_id,contentSessionId:r.content_session_id}:null}clearFailed(){return this.db.prepare(`
      DELETE FROM pending_messages
      WHERE status = 'failed'
    `).run().changes}clearAll(){return this.db.prepare(`
      DELETE FROM pending_messages
      WHERE status IN ('pending', 'processing', 'failed')
    `).run().changes}toPendingMessage(e){return{type:e.message_type,tool_name:e.tool_name||void 0,tool_input:e.tool_input?JSON.parse(e.tool_input):void 0,tool_response:e.tool_response?JSON.parse(e.tool_response):void 0,prompt_number:e.prompt_number||void 0,cwd:e.cwd||void 0,last_assistant_message:e.last_assistant_message||void 0}}};var Jt=class{constructor(e){this.db=e}async createSDKSession(e,t,r,n){return Promise.resolve(pr(this.db,e,t,r,n))}async updateMemorySessionId(e,t){mr(this.db,e,t)}async updateSessionStatus(e,t){this.db.prepare(`
      UPDATE sdk_sessions SET status = ?
      WHERE content_session_id = ?
    `).run(t,e)}async getSessionByContentId(e){return this.db.prepare(`
      SELECT * FROM sdk_sessions WHERE content_session_id = ? LIMIT 1
    `).get(e)||null}async getSessionByMemoryId(e){return this.db.prepare(`
      SELECT * FROM sdk_sessions WHERE memory_session_id = ? LIMIT 1
    `).get(e)||null}async getSessionById(e){return lr(this.db,e)&&this.db.prepare(`
      SELECT * FROM sdk_sessions WHERE id = ? LIMIT 1
    `).get(e)||null}async getAllProjects(){return Promise.resolve(Pr(this.db))}async getSessionsByProject(e,t){let r=t?`LIMIT ${t}`:"";return this.db.prepare(`
      SELECT * FROM sdk_sessions
      WHERE project = ?
      ORDER BY started_at_epoch DESC
      ${r}
    `).all(e)}async getRecentSessionsWithStatus(e,t){return Promise.resolve(Er(this.db,e,t))}async getSessionsByMemoryIds(e){return _r(this.db,e)}},Qt=class{constructor(e){this.db=e}async storeObservation(e,t,r,n,o,i){return Promise.resolve(hr(this.db,e,t,r,n,o??0,i))}async getObservationsByIds(e,t){return Promise.resolve(Tr(this.db,e,t))}async getObservationById(e){return Promise.resolve(fr(this.db,e))}async getRecentObservations(e,t){return this.db.prepare(`
      SELECT * FROM observations
      WHERE project = ?
      ORDER BY created_at_epoch DESC
      LIMIT ?
    `).all(e,t??20)}async getAllRecentObservations(e){return this.db.prepare(`
      SELECT * FROM observations
      ORDER BY created_at_epoch DESC
      LIMIT ?
    `).all(e??100)}async getObservationsForSession(e){return Promise.resolve(Sr(this.db,e))}async getFilesForSession(e){return Promise.resolve(br(this.db,e))}async getObservationCount(e){return e?this.db.prepare("SELECT COUNT(*) as count FROM observations WHERE project = ?").get(e).count:this.db.prepare("SELECT COUNT(*) as count FROM observations").get().count}},zt=class{constructor(e){this.db=e}async storeSummary(e,t,r,n,o,i){return Promise.resolve(Rr(this.db,e,t,r,n,o??0,i))}async getSummariesByIds(e,t){return Promise.resolve(Nr(this.db,e,t))}async getSummaryById(e){return Promise.resolve(Or(this.db,e))}async getSummaryForSession(e){return Promise.resolve(yr(this.db,e))}async getRecentSummaries(e,t){return this.db.prepare(`
      SELECT * FROM session_summaries
      WHERE project = ?
      ORDER BY created_at_epoch DESC
      LIMIT ?
    `).all(e,t??10)}async getRecentSummariesWithSessionInfo(e,t){return Promise.resolve(Ir(this.db,e,t))}async getAllRecentSummaries(e){return this.db.prepare(`
      SELECT * FROM session_summaries
      ORDER BY created_at_epoch DESC
      LIMIT ?
    `).all(e??50)}},Zt=class{constructor(e){this.db=e}async saveUserPrompt(e,t,r){return Promise.resolve(Ar(this.db,e,t,r))}async getPromptsByIds(e,t){return Promise.resolve(wr(this.db,e,t))}async getPromptById(e){return Promise.resolve(Mr(this.db,e))}async getUserPrompt(e,t){return Promise.resolve(Cr(this.db,e,t))}async getPromptCount(e){return Promise.resolve(Dr(this.db,e))}async getLatestUserPrompt(e){let t=vr(this.db,e);return t?{id:t.id,content_session_id:t.content_session_id,prompt_number:t.prompt_number,prompt_text:t.prompt_text,memory_session_id:t.memory_session_id,project:t.project,created_at:"",created_at_epoch:t.created_at_epoch}:null}async getAllRecentUserPrompts(e){return Promise.resolve(Lr(this.db,e))}},es=class{store;constructor(e){this.store=new dt(e)}async enqueue(e,t,r){return Promise.resolve(this.store.enqueue(e,t,r))}async claimNextMessage(e){return Promise.resolve(this.store.claimNextMessage(e))}async confirmProcessed(e){this.store.confirmProcessed(e)}async markFailed(e){this.store.markFailed(e)}async getPendingCount(e){return Promise.resolve(this.store.getPendingCount(e))}async getSessionsWithPendingMessages(){return Promise.resolve(this.store.getSessionsWithPendingMessages())}async resetStaleProcessingMessages(e,t){return Promise.resolve(this.store.resetStaleProcessingMessages(e,t))}async getQueueMessages(){return Promise.resolve(this.store.getQueueMessages())}async hasAnyPendingWork(){return Promise.resolve(this.store.hasAnyPendingWork())}async getAllPending(e){return Promise.resolve(this.store.getAllPending(e))}async resetProcessingToPending(e){return Promise.resolve(this.store.resetProcessingToPending(e))}async markSessionMessagesFailed(e){return Promise.resolve(this.store.markSessionMessagesFailed(e))}async markAllSessionMessagesAbandoned(e){return Promise.resolve(this.store.markAllSessionMessagesAbandoned(e))}toPendingMessage(e){return this.store.toPendingMessage(e)}},ts=class{constructor(e){this.db=e}async getTimelineAroundObservation(e,t,r,n,o){let i=Kt(this.db,e,t,r??10,n??10,o);return{observations:i.observations,sessions:i.sessions,prompts:i.prompts}}async getTimelineByTimeRange(e,t,r){let n=Math.floor((e+t)/2),o=Math.ceil((t-e)/2),i=Kt(this.db,null,n,1e3,1e3,r);return{observations:i.observations.filter(a=>a.created_at_epoch>=e&&a.created_at_epoch<=t),sessions:i.sessions.filter(a=>a.created_at_epoch>=e&&a.created_at_epoch<=t),prompts:i.prompts.filter(a=>a.created_at_epoch>=e&&a.created_at_epoch<=t)}}},ss=class{constructor(e){this.db=e}async fullTextSearch(e){return[]}async vectorSearch(e){return[]}async filterSearch(e){return{observations:[],sessions:[],prompts:[]}}},ut=class{providerName="sqlite";sessions;observations;summaries;prompts;pendingMessages;timeline;search;db;constructor(e){this.db=e,this.sessions=new Jt(e),this.observations=new Qt(e),this.summaries=new zt(e),this.prompts=new Zt(e),this.pendingMessages=new es(e),this.timeline=new ts(e),this.search=new ss(e)}async withTransaction(e){return this.db.transaction(()=>{let r,n;if(e(this).then(i=>{r=i},i=>{n=i}),n)throw n;return r})()}getDatabase(){return this.db}async close(){this.db.close()}async isHealthy(){try{return this.db.prepare("SELECT 1").get(),!0}catch{return!1}}};oe();var Mt=class{static async create(e){return(e.CLAUDE_MEM_STORAGE_PROVIDER||"sqlite")==="postgresql"?this.createPostgresRepository(e):this.createSqliteRepository()}static createSqliteRepository(){let{SessionStore:e}=(Fr(),Ys($r)),t=new e;return new ut(t.db)}static async createPostgres(e){return this.createPostgresRepository(e)}static async createPostgresRepository(e){let t=this.buildPostgresConfig(e);try{let{PostgresStorageRepository:r}=await Promise.resolve().then(()=>(En(),_n)),n=await r.create(t);return S.info("DB",`PostgreSQL connection established (pool: ${t.poolMin}-${t.poolMax})`),n}catch(r){let n=r instanceof Error?r.message:String(r);S.error("DB",`Failed to connect to PostgreSQL: ${n}`),console.error(`[FATAL] PostgreSQL connection failed: ${n}`),console.error("Check your CLAUDE_MEM_PG_* settings or CLAUDE_MEM_PG_CONNECTION_STRING"),process.exit(2)}}static buildPostgresConfig(e){return{host:e.CLAUDE_MEM_PG_HOST||"127.0.0.1",port:parseInt(e.CLAUDE_MEM_PG_PORT||"5432",10),database:e.CLAUDE_MEM_PG_DATABASE||"claude_mem",username:e.CLAUDE_MEM_PG_USER||"",password:e.CLAUDE_MEM_PG_PASSWORD||"",ssl:e.CLAUDE_MEM_PG_SSL==="true",connectionString:e.CLAUDE_MEM_PG_CONNECTION_STRING||"",poolMin:parseInt(e.CLAUDE_MEM_PG_POOL_MIN||"2",10),poolMax:parseInt(e.CLAUDE_MEM_PG_POOL_MAX||"10",10)}}};var gn=me(require("path"),1),hn=require("os");ct();var et=require("fs"),wt=require("path");oe();ke();var ie=class s{static instance=null;activeMode=null;modesDir;constructor(){let e=ur(),t=[(0,wt.join)(e,"modes"),(0,wt.join)(e,"..","plugin","modes")],r=t.find(n=>(0,et.existsSync)(n));this.modesDir=r||t[0]}static getInstance(){return s.instance||(s.instance=new s),s.instance}parseInheritance(e){let t=e.split("--");if(t.length===1)return{hasParent:!1,parentId:"",overrideId:""};if(t.length>2)throw new Error(`Invalid mode inheritance: ${e}. Only one level of inheritance supported (parent--override)`);return{hasParent:!0,parentId:t[0],overrideId:e}}isPlainObject(e){return e!==null&&typeof e=="object"&&!Array.isArray(e)}deepMerge(e,t){let r={...e};for(let n in t){let o=t[n],i=e[n];this.isPlainObject(o)&&this.isPlainObject(i)?r[n]=this.deepMerge(i,o):r[n]=o}return r}loadModeFile(e){let t=(0,wt.join)(this.modesDir,`${e}.json`);if(!(0,et.existsSync)(t))throw new Error(`Mode file not found: ${t}`);let r=(0,et.readFileSync)(t,"utf-8");return JSON.parse(r)}loadMode(e){let t=this.parseInheritance(e);if(!t.hasParent)try{let d=this.loadModeFile(e);return this.activeMode=d,S.debug("SYSTEM",`Loaded mode: ${d.name} (${e})`,void 0,{types:d.observation_types.map(m=>m.id),concepts:d.observation_concepts.map(m=>m.id)}),d}catch{if(S.warn("SYSTEM",`Mode file not found: ${e}, falling back to 'code'`),e==="code")throw new Error("Critical: code.json mode file missing");return this.loadMode("code")}let{parentId:r,overrideId:n}=t,o;try{o=this.loadMode(r)}catch{S.warn("SYSTEM",`Parent mode '${r}' not found for ${e}, falling back to 'code'`),o=this.loadMode("code")}let i;try{i=this.loadModeFile(n),S.debug("SYSTEM",`Loaded override file: ${n} for parent ${r}`)}catch{return S.warn("SYSTEM",`Override file '${n}' not found, using parent mode '${r}' only`),this.activeMode=o,o}if(!i)return S.warn("SYSTEM",`Invalid override file: ${n}, using parent mode '${r}' only`),this.activeMode=o,o;let a=this.deepMerge(o,i);return this.activeMode=a,S.debug("SYSTEM",`Loaded mode with inheritance: ${a.name} (${e} = ${r} + ${n})`,void 0,{parent:r,override:n,types:a.observation_types.map(d=>d.id),concepts:a.observation_concepts.map(d=>d.id)}),a}getActiveMode(){if(!this.activeMode)throw new Error("No mode loaded. Call loadMode() first.");return this.activeMode}getObservationTypes(){return this.getActiveMode().observation_types}getObservationConcepts(){return this.getActiveMode().observation_concepts}getTypeIcon(e){return this.getObservationTypes().find(r=>r.id===e)?.emoji||"\u{1F4DD}"}getWorkEmoji(e){return this.getObservationTypes().find(r=>r.id===e)?.work_emoji||"\u{1F4DD}"}validateType(e){return this.getObservationTypes().some(t=>t.id===e)}getTypeLabel(e){return this.getObservationTypes().find(r=>r.id===e)?.label||e}};function Is(){let s=gn.default.join((0,hn.homedir)(),".claude-mem","settings.json"),e=Re.loadFromFile(s),t=e.CLAUDE_MEM_MODE,r=t==="code"||t.startsWith("code--"),n,o;if(r)n=new Set(e.CLAUDE_MEM_CONTEXT_OBSERVATION_TYPES.split(",").map(i=>i.trim()).filter(Boolean)),o=new Set(e.CLAUDE_MEM_CONTEXT_OBSERVATION_CONCEPTS.split(",").map(i=>i.trim()).filter(Boolean));else{let i=ie.getInstance().getActiveMode();n=new Set(i.observation_types.map(a=>a.id)),o=new Set(i.observation_concepts.map(a=>a.id))}return{totalObservationCount:parseInt(e.CLAUDE_MEM_CONTEXT_OBSERVATIONS,10),fullObservationCount:parseInt(e.CLAUDE_MEM_CONTEXT_FULL_COUNT,10),sessionCount:parseInt(e.CLAUDE_MEM_CONTEXT_SESSION_COUNT,10),showReadTokens:e.CLAUDE_MEM_CONTEXT_SHOW_READ_TOKENS==="true",showWorkTokens:e.CLAUDE_MEM_CONTEXT_SHOW_WORK_TOKENS==="true",showSavingsAmount:e.CLAUDE_MEM_CONTEXT_SHOW_SAVINGS_AMOUNT==="true",showSavingsPercent:e.CLAUDE_MEM_CONTEXT_SHOW_SAVINGS_PERCENT==="true",observationTypes:n,observationConcepts:o,fullObservationField:e.CLAUDE_MEM_CONTEXT_FULL_FIELD,showLastSummary:e.CLAUDE_MEM_CONTEXT_SHOW_LAST_SUMMARY==="true",showLastMessage:e.CLAUDE_MEM_CONTEXT_SHOW_LAST_MESSAGE==="true"}}var T={reset:"\x1B[0m",bright:"\x1B[1m",dim:"\x1B[2m",cyan:"\x1B[36m",green:"\x1B[32m",yellow:"\x1B[33m",blue:"\x1B[34m",magenta:"\x1B[35m",gray:"\x1B[90m",red:"\x1B[31m"},fn=4,Pt=1;function As(s){let e=(s.title?.length||0)+(s.subtitle?.length||0)+(s.narrative?.length||0)+JSON.stringify(s.facts||[]).length;return Math.ceil(e/fn)}function Cs(s){let e=s.length,t=s.reduce((i,a)=>i+As(a),0),r=s.reduce((i,a)=>i+(a.discovery_tokens||0),0),n=r-t,o=r>0?Math.round(n/r*100):0;return{totalObservations:e,totalReadTokens:t,totalDiscoveryTokens:r,savings:n,savingsPercent:o}}function Vi(s){return ie.getInstance().getWorkEmoji(s)}function We(s,e){let t=As(s),r=s.discovery_tokens||0,n=Vi(s.type),o=r>0?`${n} ${r.toLocaleString()}`:"-";return{readTokens:t,discoveryTokens:r,discoveryDisplay:o,workEmoji:n}}function Ut(s){return s.showReadTokens||s.showWorkTokens||s.showSavingsAmount||s.showSavingsPercent}var Tn=me(require("path"),1),$t=require("fs");oe();ke();var Ds=5;function Sn(s,e){if(!s)return!1;try{return JSON.parse(s).some(r=>e.has(r))}catch{return!1}}function bn(s){return{id:s.id,memory_session_id:s.memory_session_id,type:s.type,title:s.title,subtitle:s.subtitle,narrative:s.narrative,facts:s.facts,concepts:s.concepts,files_read:s.files_read,files_modified:s.files_modified,discovery_tokens:s.discovery_tokens,created_at:s.created_at,created_at_epoch:s.created_at_epoch,project:s.project}}function Rn(s){return{id:s.id,memory_session_id:s.memory_session_id,request:s.request,investigated:s.investigated,learned:s.learned,completed:s.completed,next_steps:s.next_steps,created_at:s.created_at,created_at_epoch:s.created_at_epoch,project:s.project}}async function vs(s,e,t){let r=t.observationTypes,n=t.observationConcepts,o=t.totalObservationCount*Ds;return(await s.observations.getRecentObservations(e,o)).filter(a=>r.has(a.type)&&Sn(a.concepts,n)).slice(0,t.totalObservationCount).map(bn)}async function Ls(s,e,t){let r=t.sessionCount+Pt;return(await s.summaries.getRecentSummaries(e,r)).map(Rn)}async function yn(s,e,t){let r=t.observationTypes,n=t.observationConcepts,o=new Set(e),i=t.totalObservationCount*Ds;return(await s.observations.getAllRecentObservations(i)).filter(d=>o.has(d.project)&&r.has(d.type)&&Sn(d.concepts,n)).slice(0,t.totalObservationCount).map(bn)}async function On(s,e,t){let r=new Set(e),n=(t.sessionCount+Pt)*Ds;return(await s.summaries.getAllRecentSummaries(n)).filter(i=>r.has(i.project)).slice(0,t.sessionCount+Pt).map(Rn)}function Ki(s){return s.replace(/\//g,"-")}function Ji(s){try{if(!(0,$t.existsSync)(s))return{userMessage:"",assistantMessage:""};let e=(0,$t.readFileSync)(s,"utf-8").trim();if(!e)return{userMessage:"",assistantMessage:""};let t=e.split(`
`).filter(n=>n.trim()),r="";for(let n=t.length-1;n>=0;n--)try{let o=t[n];if(!o.includes('"type":"assistant"'))continue;let i=JSON.parse(o);if(i.type==="assistant"&&i.message?.content&&Array.isArray(i.message.content)){let a="";for(let d of i.message.content)d.type==="text"&&(a+=d.text);if(a=a.replace(/<system-reminder>[\s\S]*?<\/system-reminder>/g,"").trim(),a){r=a;break}}}catch(o){S.debug("PARSER","Skipping malformed transcript line",{lineIndex:n},o);continue}return{userMessage:"",assistantMessage:r}}catch(e){return S.failure("WORKER","Failed to extract prior messages from transcript",{transcriptPath:s},e),{userMessage:"",assistantMessage:""}}}function Ms(s,e,t,r){if(!e.showLastMessage||s.length===0)return{userMessage:"",assistantMessage:""};let n=s.find(d=>d.memory_session_id!==t);if(!n)return{userMessage:"",assistantMessage:""};let o=n.memory_session_id,i=Ki(r),a=Tn.default.join(Fe,"projects",i,`${o}.jsonl`);return Ji(a)}function Nn(s,e){let t=e[0]?.id;return s.map((r,n)=>{let o=n===0?null:e[n+1];return{...r,displayEpoch:o?o.created_at_epoch:r.created_at_epoch,displayTime:o?o.created_at:r.created_at,shouldShowLink:r.id!==t}})}function ws(s,e){let t=[...s.map(r=>({type:"observation",data:r})),...e.map(r=>({type:"summary",data:r}))];return t.sort((r,n)=>{let o=r.type==="observation"?r.data.created_at_epoch:r.data.displayEpoch,i=n.type==="observation"?n.data.created_at_epoch:n.data.displayEpoch;return o-i}),t}function In(s,e){return new Set(s.slice(0,e).map(t=>t.id))}function An(){let s=new Date,e=s.toLocaleDateString("en-CA"),t=s.toLocaleTimeString("en-US",{hour:"numeric",minute:"2-digit",hour12:!0}).toLowerCase().replace(" ",""),r=s.toLocaleTimeString("en-US",{timeZoneName:"short"}).split(" ").pop();return`${e} ${t} ${r}`}function Cn(s){return[`# [${s}] recent context, ${An()}`,""]}function Dn(){return[`**Legend:** session-request | ${ie.getInstance().getActiveMode().observation_types.map(t=>`${t.emoji} ${t.id}`).join(" | ")}`,""]}function vn(){return["**Column Key**:","- **Read**: Tokens to read this observation (cost to learn it now)","- **Work**: Tokens spent on work that produced this record ( research, building, deciding)",""]}function Ln(){return["**Context Index:** This semantic index (titles, types, files, tokens) is usually sufficient to understand past work.","","When you need implementation details, rationale, or debugging context:","- Fetch by ID: get_observations([IDs]) for observations visible in this index","- Search history: Use the mem-search skill for past decisions, bugs, and deeper research","- Trust this index over re-reading code for past decisions and learnings",""]}function Mn(s,e){let t=[];if(t.push("**Context Economics**:"),t.push(`- Loading: ${s.totalObservations} observations (${s.totalReadTokens.toLocaleString()} tokens to read)`),t.push(`- Work investment: ${s.totalDiscoveryTokens.toLocaleString()} tokens spent on research, building, and decisions`),s.totalDiscoveryTokens>0&&(e.showSavingsAmount||e.showSavingsPercent)){let r="- Your savings: ";e.showSavingsAmount&&e.showSavingsPercent?r+=`${s.savings.toLocaleString()} tokens (${s.savingsPercent}% reduction from reuse)`:e.showSavingsAmount?r+=`${s.savings.toLocaleString()} tokens`:r+=`${s.savingsPercent}% reduction from reuse`,t.push(r)}return t.push(""),t}function wn(s){return[`### ${s}`,""]}function Pn(s){return[`**${s}**`,"| ID | Time | T | Title | Read | Work |","|----|------|---|-------|------|------|"]}function Un(s,e,t){let r=s.title||"Untitled",n=ie.getInstance().getTypeIcon(s.type),{readTokens:o,discoveryDisplay:i}=We(s,t),a=t.showReadTokens?`~${o}`:"",d=t.showWorkTokens?i:"";return`| #${s.id} | ${e||'"'} | ${n} | ${r} | ${a} | ${d} |`}function $n(s,e,t,r){let n=[],o=s.title||"Untitled",i=ie.getInstance().getTypeIcon(s.type),{readTokens:a,discoveryDisplay:d}=We(s,r);n.push(`**#${s.id}** ${e||'"'} ${i} **${o}**`),t&&(n.push(""),n.push(t),n.push(""));let m=[];return r.showReadTokens&&m.push(`Read: ~${a}`),r.showWorkTokens&&m.push(`Work: ${d}`),m.length>0&&n.push(m.join(", ")),n.push(""),n}function Fn(s,e){let t=`${s.request||"Session started"} (${e})`;return[`**#S${s.id}** ${t}`,""]}function tt(s,e){return e?[`**${s}**: ${e}`,""]:[]}function kn(s){return s.assistantMessage?["","---","","**Previously**","",`A: ${s.assistantMessage}`,""]:[]}function xn(s,e){return["",`Access ${Math.round(s/1e3)}k tokens of past research & decisions for just ${e.toLocaleString()}t. Use the claude-mem skill to access memories by ID.`]}function jn(s){return`# [${s}] recent context, ${An()}

No previous sessions found for this project yet.`}function Bn(){let s=new Date,e=s.toLocaleDateString("en-CA"),t=s.toLocaleTimeString("en-US",{hour:"numeric",minute:"2-digit",hour12:!0}).toLowerCase().replace(" ",""),r=s.toLocaleTimeString("en-US",{timeZoneName:"short"}).split(" ").pop();return`${e} ${t} ${r}`}function Hn(s){return["",`${T.bright}${T.cyan}[${s}] recent context, ${Bn()}${T.reset}`,`${T.gray}${"\u2500".repeat(60)}${T.reset}`,""]}function Wn(){let e=ie.getInstance().getActiveMode().observation_types.map(t=>`${t.emoji} ${t.id}`).join(" | ");return[`${T.dim}Legend: session-request | ${e}${T.reset}`,""]}function Xn(){return[`${T.bright}Column Key${T.reset}`,`${T.dim}  Read: Tokens to read this observation (cost to learn it now)${T.reset}`,`${T.dim}  Work: Tokens spent on work that produced this record ( research, building, deciding)${T.reset}`,""]}function Gn(){return[`${T.dim}Context Index: This semantic index (titles, types, files, tokens) is usually sufficient to understand past work.${T.reset}`,"",`${T.dim}When you need implementation details, rationale, or debugging context:${T.reset}`,`${T.dim}  - Fetch by ID: get_observations([IDs]) for observations visible in this index${T.reset}`,`${T.dim}  - Search history: Use the mem-search skill for past decisions, bugs, and deeper research${T.reset}`,`${T.dim}  - Trust this index over re-reading code for past decisions and learnings${T.reset}`,""]}function qn(s,e){let t=[];if(t.push(`${T.bright}${T.cyan}Context Economics${T.reset}`),t.push(`${T.dim}  Loading: ${s.totalObservations} observations (${s.totalReadTokens.toLocaleString()} tokens to read)${T.reset}`),t.push(`${T.dim}  Work investment: ${s.totalDiscoveryTokens.toLocaleString()} tokens spent on research, building, and decisions${T.reset}`),s.totalDiscoveryTokens>0&&(e.showSavingsAmount||e.showSavingsPercent)){let r="  Your savings: ";e.showSavingsAmount&&e.showSavingsPercent?r+=`${s.savings.toLocaleString()} tokens (${s.savingsPercent}% reduction from reuse)`:e.showSavingsAmount?r+=`${s.savings.toLocaleString()} tokens`:r+=`${s.savingsPercent}% reduction from reuse`,t.push(`${T.green}${r}${T.reset}`)}return t.push(""),t}function Yn(s){return[`${T.bright}${T.cyan}${s}${T.reset}`,""]}function Vn(s){return[`${T.dim}${s}${T.reset}`]}function Kn(s,e,t,r){let n=s.title||"Untitled",o=ie.getInstance().getTypeIcon(s.type),{readTokens:i,discoveryTokens:a,workEmoji:d}=We(s,r),m=t?`${T.dim}${e}${T.reset}`:" ".repeat(e.length),l=r.showReadTokens&&i>0?`${T.dim}(~${i}t)${T.reset}`:"",g=r.showWorkTokens&&a>0?`${T.dim}(${d} ${a.toLocaleString()}t)${T.reset}`:"";return`  ${T.dim}#${s.id}${T.reset}  ${m}  ${o}  ${n} ${l} ${g}`}function Jn(s,e,t,r,n){let o=[],i=s.title||"Untitled",a=ie.getInstance().getTypeIcon(s.type),{readTokens:d,discoveryTokens:m,workEmoji:l}=We(s,n),g=t?`${T.dim}${e}${T.reset}`:" ".repeat(e.length),h=n.showReadTokens&&d>0?`${T.dim}(~${d}t)${T.reset}`:"",p=n.showWorkTokens&&m>0?`${T.dim}(${l} ${m.toLocaleString()}t)${T.reset}`:"";return o.push(`  ${T.dim}#${s.id}${T.reset}  ${g}  ${a}  ${T.bright}${i}${T.reset}`),r&&o.push(`    ${T.dim}${r}${T.reset}`),(h||p)&&o.push(`    ${h} ${p}`),o.push(""),o}function Qn(s,e){let t=`${s.request||"Session started"} (${e})`;return[`${T.yellow}#S${s.id}${T.reset} ${t}`,""]}function st(s,e,t){return e?[`${t}${s}:${T.reset} ${e}`,""]:[]}function zn(s){return s.assistantMessage?["","---","",`${T.bright}${T.magenta}Previously${T.reset}`,"",`${T.dim}A: ${s.assistantMessage}${T.reset}`,""]:[]}function Zn(s,e){let t=Math.round(s/1e3);return["",`${T.dim}Access ${t}k tokens of past research & decisions for just ${e.toLocaleString()}t. Use the claude-mem skill to access memories by ID.${T.reset}`]}function eo(s){return`
${T.bright}${T.cyan}[${s}] recent context, ${Bn()}${T.reset}
${T.gray}${"\u2500".repeat(60)}${T.reset}

${T.dim}No previous sessions found for this project yet.${T.reset}
`}function to(s,e,t,r){let n=[];return r?n.push(...Hn(s)):n.push(...Cn(s)),r?n.push(...Wn()):n.push(...Dn()),r?n.push(...Xn()):n.push(...vn()),r?n.push(...Gn()):n.push(...Ln()),Ut(t)&&(r?n.push(...qn(e,t)):n.push(...Mn(e,t))),n}var Ps=me(require("path"),1);oe();function xt(s){if(!s)return[];try{let e=JSON.parse(s);return Array.isArray(e)?e:[]}catch(e){return S.debug("PARSER","Failed to parse JSON array, using empty fallback",{preview:s?.substring(0,50)},e),[]}}function ro(s){return new Date(s).toLocaleString("en-US",{month:"short",day:"numeric",hour:"numeric",minute:"2-digit",hour12:!0})}function no(s){return new Date(s).toLocaleString("en-US",{hour:"numeric",minute:"2-digit",hour12:!0})}function oo(s){return new Date(s).toLocaleString("en-US",{month:"short",day:"numeric",year:"numeric"})}function so(s,e){return Ps.default.isAbsolute(s)?Ps.default.relative(e,s):s}function io(s,e,t){let r=xt(s);if(r.length>0)return so(r[0],e);if(t){let n=xt(t);if(n.length>0)return so(n[0],e)}return"General"}function Qi(s){let e=new Map;for(let r of s){let n=r.type==="observation"?r.data.created_at:r.data.displayTime,o=oo(n);e.has(o)||e.set(o,[]),e.get(o).push(r)}let t=Array.from(e.entries()).sort((r,n)=>{let o=new Date(r[0]).getTime(),i=new Date(n[0]).getTime();return o-i});return new Map(t)}function zi(s,e){return e.fullObservationField==="narrative"?s.narrative:s.facts?xt(s.facts).join(`
`):null}function Zi(s,e,t,r,n,o){let i=[];o?i.push(...Yn(s)):i.push(...wn(s));let a=null,d="",m=!1;for(let l of e)if(l.type==="summary"){m&&(i.push(""),m=!1,a=null,d="");let g=l.data,h=ro(g.displayTime);o?i.push(...Qn(g,h)):i.push(...Fn(g,h))}else{let g=l.data,h=io(g.files_modified,n,g.files_read),p=no(g.created_at),y=p!==d,_=y?p:"";d=p;let f=t.has(g.id);if(h!==a&&(m&&i.push(""),o?i.push(...Vn(h)):i.push(...Pn(h)),a=h,m=!0),f){let O=zi(g,r);o?i.push(...Jn(g,p,y,O,r)):(m&&!o&&(i.push(""),m=!1),i.push(...$n(g,_,O,r)),a=null)}else o?i.push(Kn(g,p,y,r)):i.push(Un(g,_,r))}return m&&i.push(""),i}function ao(s,e,t,r,n){let o=[],i=Qi(s);for(let[a,d]of i)o.push(...Zi(a,d,e,t,r,n));return o}function co(s,e,t){return!(!s.showLastSummary||!e||!!!(e.investigated||e.learned||e.completed||e.next_steps)||t&&e.created_at_epoch<=t.created_at_epoch)}function uo(s,e){let t=[];return e?(t.push(...st("Investigated",s.investigated,T.blue)),t.push(...st("Learned",s.learned,T.yellow)),t.push(...st("Completed",s.completed,T.green)),t.push(...st("Next Steps",s.next_steps,T.magenta))):(t.push(...tt("Investigated",s.investigated)),t.push(...tt("Learned",s.learned)),t.push(...tt("Completed",s.completed)),t.push(...tt("Next Steps",s.next_steps))),t}function po(s,e){return e?zn(s):kn(s)}function mo(s,e,t){return!Ut(e)||s.totalDiscoveryTokens<=0||s.savings<=0?[]:t?Zn(s.totalDiscoveryTokens,s.totalReadTokens):xn(s.totalDiscoveryTokens,s.totalReadTokens)}var ea=lo.default.join((0,_o.homedir)(),".claude","plugins","marketplaces","thedotmack","plugin",".install-version");async function ta(){try{let s=Re.loadFromFile(ir);return await Mt.create(s)}catch(s){if(s.code==="ERR_DLOPEN_FAILED"){try{(0,Eo.unlinkSync)(ea)}catch(e){S.debug("SYSTEM","Marker file cleanup failed (may not exist)",{},e)}return S.error("SYSTEM","Native module rebuild needed - restart Claude Code to auto-fix"),null}throw s}}function sa(s,e){return e?eo(s):jn(s)}function ra(s,e,t,r,n,o,i){let a=[],d=Cs(e);a.push(...to(s,d,r,i));let m=t.slice(0,r.sessionCount),l=Nn(m,t),g=ws(e,l),h=In(e,r.fullObservationCount);a.push(...ao(g,h,r,n,i));let p=t[0],y=e[0];co(r,p,y)&&a.push(...uo(p,i));let _=Ms(e,r,o,n);return a.push(...po(_,i)),a.push(...mo(d,r,i)),a.join(`
`).trimEnd()}async function Us(s,e=!1){let t=Is(),r=s?.cwd??process.cwd(),n=Qs(r),o=s?.projects||[n],i=await ta();if(!i)return"";try{let a=o.length>1?await yn(i,o,t):await vs(i,n,t),d=o.length>1?await On(i,o,t):await Ls(i,n,t);return a.length===0&&d.length===0?sa(n,e):ra(n,a,d,t,r,s?.session_id,e)}finally{await i.close()}}0&&(module.exports={generateContext});
