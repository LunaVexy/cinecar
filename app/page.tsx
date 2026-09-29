"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ArrowLeft, ArrowRight, CalendarDays, Check, CloudRain, ExternalLink, Film, LoaderCircle, LogOut, MapPin, MoonStar, Popcorn, RefreshCw, Share2, Sparkles, Star, Ticket, Users, KeyRound } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Progress } from "@/components/ui/progress";
import { genres, type FilmOption } from "@/lib/films";

type Day = { date: string; rain: number; chance: number | null; historic: boolean };
type Vote = { voterId: string; name: string; avatar: string | null; filmId: string; ticketId: string | null };
type Board = { started: boolean; films: FilmOption[]; session?: { id: string; city: string | null; selectedDate: string | null; driveFileId: string | null; driveResourceKey: string | null }; votes: Vote[]; tally: { filmId: string; total: number }[]; totalVotes: number; finished: boolean; winner: string | null };
type Place = { name: string; admin1?: string; country?: string; latitude: number; longitude: number };
type Identity = { email: string; voterId: string };

const tickets = [
  { id:"cobertor", title:"Poltrona & petiscos", bring:"Sanduíches para dividir + uma cobertinha macia", note:"Lanche salgado e aconchego no banco de trás", emoji:"🥪", code:"CC-01" },
  { id:"pipoca", title:"Estreia doce", bring:"Pipoca para dividir + seu doce favorito + um travesseiro", note:"O combo oficial da sessão", emoji:"🍿", code:"CC-02" },
];
const characters = [
  { id:"andrey", name:"Andrey" },
  { id:"hugo", name:"Hugo" },
  { id:"matheus", name:"Matheus" },
];
function Avatar({id,small=false}:{id:string|null|undefined;small?:boolean}) { return <span className={"avatar avatar-"+(id||"matheus")+(small?" avatar-small":"")} aria-hidden="true"/>; }
const dateText = (value:string, options?:Intl.DateTimeFormatOptions) => new Date(value+"T12:00:00").toLocaleDateString("pt-BR", options || {weekday:"short", day:"2-digit", month:"long"});
const dateISO = (date:Date) => [date.getFullYear(),String(date.getMonth()+1).padStart(2,"0"),String(date.getDate()).padStart(2,"0")].join("-");
const shiftDate = (date:Date, amount:number) => { const copy=new Date(date.getFullYear(),date.getMonth(),date.getDate()); copy.setDate(copy.getDate()+amount); return copy; };
export default function Home() {
  const autoWeather=useRef(false);
  const [sessionId,setSessionId]=useState("cinecar"),[voterId,setVoterId]=useState(""),[email,setEmail]=useState(""),[avatar,setAvatar]=useState("");
  const [identity,setIdentity]=useState<Identity|null>(null),[code,setCode]=useState(""),[codeSentAt,setCodeSentAt]=useState(0);
  const [clock,setClock]=useState(Date.now());
  const [popcorn,setPopcorn]=useState<{id:number;x:number;y:number}[]>([]);
  const [board,setBoard]=useState<Board|null>(null),[screen,setScreen]=useState("loading");
  const [city,setCity]=useState("Pelotas"),[place,setPlace]=useState<Place|null>(null),[days,setDays]=useState<Day[]>([]);
  const [weatherBusy,setWeatherBusy]=useState(false),[weatherError,setWeatherError]=useState("");
  const [genre,setGenre]=useState("Terror"),[filmId,setFilmId]=useState(""),[filmDetails,setFilmDetails]=useState<FilmOption|null>(null),[posters,setPosters]=useState<Record<string,string>>({});
  const [ticketId,setTicketId]=useState(""),[busy,setBusy]=useState(false),[message,setMessage]=useState(""),[share,setShare]=useState("");

  const sync=useCallback(async(id:string)=>{const response=await fetch("/api/session?id="+encodeURIComponent(id),{cache:"no-store"});const data=await response.json() as Board & {error?:string};if(!response.ok)throw new Error(data.error||"Não foi possível abrir a sessão.");setBoard(data);if(!data.started)setScreen("idle");return data;},[]);
  useEffect(()=>{
    const id=new URLSearchParams(location.search).get("sessao")||"cinecar";setSessionId(id);
    const savedAvatar=localStorage.getItem("cinecar:avatar:"+id)||"";
    Promise.all([fetch("/api/auth",{cache:"no-store"}).then(r=>r.ok?r.json() as Promise<Identity>:null).catch(()=>null),sync(id)])
      .then(([person,data])=>{if(!data.started){setScreen("idle");return;}if(data.session?.city)setCity(data.session.city);
        if(person){setIdentity(person);setEmail(person.email);setVoterId(person.voterId);}
        const own=data.votes.find(v=>v.voterId===person?.voterId);
        const chosenAvatar=own?.avatar||savedAvatar;
        if(chosenAvatar)setAvatar(chosenAvatar);
        if(!person||!chosenAvatar)setScreen("welcome");
        else if(!data.session?.selectedDate)setScreen("date");
        else if(data.finished)setScreen("result");
        else setScreen(own?.ticketId?"waiting":own?"ticket":"movies");
      }).catch((e)=>{setMessage(e instanceof Error?e.message:"A sessão não carregou.");setScreen("welcome");});
  },[sync]);
  const films=board?.films||[];
  useEffect(()=>{if(screen!=="verify")return;const timer=setInterval(()=>setClock(Date.now()),1000);return()=>clearInterval(timer);},[screen]);
  useEffect(()=>{
    const titles=[...new Set((board?.films||[]).map((f)=>f.wiki).filter(Boolean))].join("|");
    if(!titles)return;
    fetch("https://en.wikipedia.org/w/api.php?action=query&prop=pageimages&piprop=thumbnail&pithumbsize=700&format=json&formatversion=2&origin=*&titles="+encodeURIComponent(titles))
      .then(r=>r.json()).then((raw:unknown)=>{const data=raw as {query?:{pages?:Array<{title:string;thumbnail?:{source?:string}}>}};const map:Record<string,string>={};for(const p of data?.query?.pages||[])if(p.thumbnail?.source)map[p.title.toLowerCase()]=p.thumbnail.source;setPosters(map);}).catch(()=>{});
  },[board?.films]);
  useEffect(()=>{if(films.length&&!films.some(f=>f.genre===genre))setGenre(films[0].genre);},[board?.films,genre]);
  const activeGenres=genres.filter(g=>films.some(f=>f.genre===g));
  const ownVote=board?.votes.find((v)=>v.voterId===voterId);
  const winner=films.find((f)=>f.id===board?.winner);
  const picked=films.find((f)=>f.id===filmId);
  const currentFilms=films.filter((f)=>f.genre===genre);
  const actual=days;

  const loadWeather=useCallback(async()=>{
    setWeatherBusy(true);setWeatherError("");setDays([]);setPlace(null);
    try{
      const geo=await fetch("https://geocoding-api.open-meteo.com/v1/search?name="+encodeURIComponent(city)+"&count=5&language=pt&format=json").then(r=>r.json()) as {results?:Place[]};
      const p=geo.results?.[0] as Place|undefined;if(!p)throw new Error("Não encontrei a cidade. Tente acrescentar a sigla do estado.");
      setPlace(p);
      const forecast="https://api.open-meteo.com/v1/forecast?latitude="+p.latitude+"&longitude="+p.longitude+"&daily=precipitation_sum,precipitation_probability_max&forecast_days=16&timezone=auto";
      const response=await fetch(forecast);if(!response.ok)throw new Error("A previsão não está disponível agora. Tente novamente.");
      const data=await response.json() as {daily?:{time:string[];precipitation_sum:number[];precipitation_probability_max:number[]}};
      if(!data.daily?.time)throw new Error("A previsão não carregou. Tente novamente.");
      const today=dateISO(new Date());
      const found:Day[]=data.daily.time.flatMap((date,i)=>{const rain=Number(data.daily?.precipitation_sum?.[i]||0),chance=data.daily?.precipitation_probability_max?.[i];return date>=today&&(rain>=.5||(chance??0)>=35)?[{date,rain,chance:chance??null,historic:false}]:[];});
      setDays(found);if(!found.length)setWeatherError("Não achei dias chuvosos prováveis nesse período. Tente outra cidade.");
    }catch(e){setWeatherError(e instanceof Error?e.message:"A previsão não carregou. Tente novamente.");}finally{setWeatherBusy(false);}
  },[city]);
  useEffect(()=>{if(screen==="date"&&!autoWeather.current){autoWeather.current=true;void loadWeather();}},[screen,loadWeather]);

  async function post(action:Record<string,unknown>){const response=await fetch("/api/session",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({...action,sessionId})});const data=await response.json() as {error?:string};if(!response.ok)throw new Error(data.error||"Não foi possível guardar sua escolha.");return data;}
  async function selectDate(day:Day){if(!place)return;setBusy(true);setMessage("");try{await post({action:"set-date",date:day.date,city:[place.name,place.admin1].filter(Boolean).join(", "),latitude:place.latitude,longitude:place.longitude});const data=await sync(sessionId);setScreen(data.finished?"result":"movies");}catch(e){const data=await sync(sessionId).catch(()=>null);if(data?.session?.selectedDate)setScreen(data.finished?"result":"movies");else setMessage(e instanceof Error?e.message:"A data não foi salva.");}finally{setBusy(false);}}
  async function submitVote(){if(!identity||!avatar){setScreen("welcome");return;}if(!filmId){setMessage("Escolha um filme para registrar seu voto.");return;}setBusy(true);setMessage("");try{await post({action:"vote",avatar,filmId});await sync(sessionId);setScreen("ticket");}catch(e){const data=await sync(sessionId).catch(()=>null);if(data?.finished)setScreen("result");else setMessage(e instanceof Error?e.message:"O voto não foi registrado.");}finally{setBusy(false);}}
  async function submitTicket(){if(!ticketId){setMessage("Escolha um ingresso para continuar.");return;}setBusy(true);setMessage("");try{await post({action:"ticket",voterId,ticketId});const data=await sync(sessionId);setScreen(data.finished?"result":"waiting");}catch(e){setMessage(e instanceof Error?e.message:"O ingresso não foi salvo.");}finally{setBusy(false);}}
  useEffect(()=>{if(screen!=="waiting")return;const timer=setInterval(()=>sync(sessionId).then(data=>{if(data.finished)setScreen("result");}).catch(()=>{}),4500);return()=>clearInterval(timer);},[screen,sessionId,sync]);

  function afterLogin(person:Identity){
    setIdentity(person);setEmail(person.email);setVoterId(person.voterId);
    localStorage.setItem("cinecar:avatar:"+sessionId,avatar);setMessage("");
    const own=board?.votes.find(v=>v.voterId===person.voterId);
    setScreen(!board?.session?.selectedDate?"date":board.finished?"result":own?.ticketId?"waiting":own?"ticket":"movies");
  }
  async function enter(){
    const normalized=email.trim().toLowerCase();
    if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalized)){setMessage("Digite um e-mail válido para continuar.");return;}
    if(!avatar){setMessage("Escolha seu personagem.");return;}
    const taken=!board?.finished&&board?.votes.some(v=>v.avatar===avatar&&v.voterId!==identity?.voterId);
    if(taken){setMessage("Este personagem já votou nesta sessão. Escolha outro.");return;}
    if(identity?.email===normalized){afterLogin(identity);return;}
    setBusy(true);setMessage("");
    try{const response=await fetch("/api/auth",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({action:"send",email:normalized})});const data=await response.json() as {error?:string};if(!response.ok)throw new Error(data.error||"Não foi possível enviar o código.");setEmail(normalized);setCode("");setCodeSentAt(Date.now());setScreen("verify");}
    catch(e){setMessage(e instanceof Error?e.message:"Não foi possível enviar o código.");}finally{setBusy(false);}
  }
  async function verify(){setBusy(true);setMessage("");try{const response=await fetch("/api/auth",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({action:"verify",email,code})});const data=await response.json() as Identity & {error?:string};if(!response.ok)throw new Error(data.error||"Código incorreto.");afterLogin(data);}catch(e){setMessage(e instanceof Error?e.message:"Código incorreto.");}finally{setBusy(false);}}
  async function resend(){if(Date.now()-codeSentAt<60000)return;setBusy(true);setMessage("");try{const response=await fetch("/api/auth",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({action:"send",email})});const data=await response.json() as {error?:string};if(!response.ok)throw new Error(data.error||"Não foi possível reenviar.");setCodeSentAt(Date.now());setCode("");setMessage("Enviamos um novo código para seu e-mail.");}catch(e){setMessage(e instanceof Error?e.message:"Não foi possível reenviar.");}finally{setBusy(false);}}
  async function logout(){setBusy(true);try{await fetch("/api/auth",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({action:"logout"})});setIdentity(null);setVoterId("");setEmail("");setAvatar("");setCode("");localStorage.removeItem("cinecar:avatar:"+sessionId);setMessage("");setScreen(board?.started?"welcome":"idle");}catch{setMessage("Não foi possível sair. Tente novamente.");}finally{setBusy(false);}}
  function burst(event:React.MouseEvent<HTMLElement>){
    if(!(event.target as HTMLElement).closest("button,a,label.ticket-option"))return;
    const id=Date.now()+Math.random();setPopcorn(items=>[...items.slice(-4),{id,x:event.clientX,y:event.clientY}]);
    window.setTimeout(()=>setPopcorn(items=>items.filter(item=>item.id!==id)),850);
  }
  async function invite(){const activeId=board?.session?.id||sessionId;const url=location.origin+location.pathname+(activeId==="cinecar"?"":"?sessao="+encodeURIComponent(activeId));try{await navigator.clipboard.writeText(url);setShare("Convite copiado! Mande no grupo.");}catch{setShare(url);}setTimeout(()=>setShare(""),3200);}
  useEffect(()=>{
    const context=(document as Document & {modelContext?:{registerTool?:(tool:unknown,options?:{signal?:AbortSignal})=>unknown}}).modelContext;
    if(!context?.registerTool||!identity)return;
    const controller=new AbortController();
    const register=async()=>{
      await context.registerTool?.({
        name:"cinecar_session_status",
        title:"Ver status do CineCar",
        description:"Consulta a data escolhida, quantidade de votos e filme vencedor da sessão atual.",
        inputSchema:{type:"object",properties:{},additionalProperties:false},
        annotations:{readOnlyHint:true,untrustedContentHint:false},
        async execute(){const data=await sync(sessionId);return {date:data.session?.selectedDate||null,votes:data.totalVotes,finished:data.finished,winner:data.winner};}
      },{signal:controller.signal});
      await context.registerTool?.({
        name:"cinecar_vote_for_movie",
        title:"Votar em um filme",
        description:"Registra o voto de uma pessoa em um dos filmes disponíveis e abre a etapa de ingresso.",
        inputSchema:{type:"object",properties:{avatar:{type:"string",enum:characters.map(c=>c.id)},filmId:{type:"string",enum:films.map(f=>f.id)}},required:["avatar","filmId"],additionalProperties:false},
        annotations:{readOnlyHint:false,untrustedContentHint:false},
        async execute(input:unknown){const data=input as {avatar:string;filmId:string};await post({action:"vote",avatar:data.avatar,filmId:data.filmId});setAvatar(data.avatar);setFilmId(data.filmId);setScreen("ticket");await sync(sessionId);return {ok:true,next:"ticket"};}
      },{signal:controller.signal});
      await context.registerTool?.({
        name:"cinecar_choose_ticket",
        title:"Escolher ingresso",
        description:"Salva o que a pessoa vai levar e abre a tela de espera do resultado.",
        inputSchema:{type:"object",properties:{ticketId:{type:"string",enum:tickets.map(t=>t.id)}},required:["ticketId"],additionalProperties:false},
        annotations:{readOnlyHint:false,untrustedContentHint:false},
        async execute(input:unknown){const data=input as {ticketId:string};await post({action:"ticket",voterId,ticketId:data.ticketId});setTicketId(data.ticketId);setScreen("waiting");await sync(sessionId);return {ok:true,next:"waiting"};}
      },{signal:controller.signal});
    };
    void register().catch(()=>{});
    return ()=>controller.abort();
  },[identity,sessionId]);
  useEffect(()=>{if(["loading","idle","waiting"].includes(screen))return;const timer=setInterval(()=>{void sync(sessionId).catch(()=>{});},9000);return()=>clearInterval(timer);},[screen,sessionId,sync]);
  useEffect(()=>{if(screen!=="idle"||sessionId!=="cinecar")return;const timer=setInterval(()=>sync(sessionId).then(data=>{if(data.started)setScreen("welcome");}).catch(()=>{}),6000);return()=>clearInterval(timer);},[screen,sessionId,sync]);
  const step=screen==="date"?1:screen==="movies"?2:screen==="ticket"?3:4;

  return <main className={"shell"+(screen==="result"?" result-shell":"")} onClickCapture={burst}><div className="rain" aria-hidden="true">{Array.from({length:44},(_,i)=><i key={i} style={{left:(i*37.7)%100+"%",animationDelay:(i%11)*-.21+"s",animationDuration:1.1+(i%5)*.24+"s"}} />)}</div>
    <div className="popcorn-layer" aria-hidden="true">{popcorn.map(p=><span key={p.id} style={{left:p.x,top:p.y}}>{[0,1,2,3,4,5].map(i=><i key={i} style={{"--angle":i*60+"deg"} as React.CSSProperties}>🍿</i>)}</span>)}</div>
    <header className="topbar"><a className="logo" href="/"><span className="logo-icon"><Film size={19}/></span><span className="brand-name">Cine<span>Car</span></span></a><div className="top-actions"><span className="session-label"><i/> {avatar?characters.find(c=>c.id===avatar)?.name:"sessão entre amigos"}</span><a className="admin-entry" href="/admin" aria-label="Painel de programação"><KeyRound size={16}/><span>Painel</span></a>{identity&&<button className="admin-entry" onClick={()=>void logout()} disabled={busy} aria-label="Sair e trocar e-mail"><LogOut size={16}/><span>Sair</span></button>}{board?.started&&<button className="outline-button" onClick={invite}><Share2 size={16}/> Convide o grupo</button>}</div></header>

    {screen==="loading"&&<div className="loading"><LoaderCircle className="spin" size={30}/> Abrindo a sessão…</div>}

    {screen==="idle"&&<section className="content idle-screen"><div className="idle-copy"><div className="eyebrow"><Film size={16}/> CINECAR · EM BREVE</div><h1>A sessão ainda<br/><em>não começou.</em></h1><p className="lead">Estamos escolhendo os filmes em cartaz. Volte daqui a pouco para marcar a data e votar com o grupo.</p><div className="idle-status"><span className="idle-pulse"/> Aguardando a programação</div></div><img src="/car-rain.png" alt="Carro e tablet aguardando a próxima sessão"/></section>}

    {screen==="welcome"&&<section className="content welcome"><div className="welcome-copy"><div className="eyebrow"><Sparkles size={15}/> SUA SESSÃO COMEÇA AQUI</div><h1>Escolha seu lugar<br/><em>no CineCar.</em></h1><p className="lead">Um e-mail e um personagem para saber quem escolheu cada filme. Depois é só pegar seu ingresso.</p><img className="welcome-car" src="/car-rain.png" alt="Carro sob a chuva com tablet iluminado"/></div><div className="welcome-card"><span className="card-kicker">01 / ENTRADA</span><h2>Quem chegou?</h2><label className="email-field">Seu e-mail<input type="email" autoComplete="email" value={email} onChange={e=>setEmail(e.target.value)} onKeyDown={e=>{if(e.key==="Enter")void enter();}} placeholder="voce@exemplo.com"/></label><p>Escolha seu personagem</p><div className="character-grid">{characters.map(c=><button type="button" key={c.id} disabled={!board?.finished&&board?.votes.some(v=>v.avatar===c.id&&v.voterId!==voterId)} className={"character"+(avatar===c.id?" chosen":"")} onClick={()=>{setAvatar(c.id);setMessage("");}}><Avatar id={c.id}/><strong>{c.name}</strong></button>)}</div>{message&&<p className="error">{message}</p>}<button className="primary-button enter-button" disabled={busy} onClick={()=>void enter()}>{busy?<LoaderCircle className="spin" size={17}/>:<ArrowRight size={17}/>} {identity?.email===email.trim().toLowerCase()?"Entrar na sessão":"Enviar código por e-mail"}</button><small className="privacy-note">Enviaremos um código de seis números para confirmar que o e-mail é seu.</small></div></section>}

    {screen==="verify"&&<section className="content welcome"><div className="welcome-copy"><div className="eyebrow"><KeyRound size={15}/> CONFIRME SUA ENTRADA</div><h1>Seu lugar está<br/><em>quase reservado.</em></h1><p className="lead">Confira a caixa de entrada e o spam. O código vale por dez minutos.</p><img className="welcome-car" src="/car-rain.png" alt="Carro sob a chuva com tablet iluminado"/></div><div className="welcome-card verify-card"><div className="verify-heading"><span className="verify-icon"><Ticket size={22}/></span><span className="card-kicker">02 / VERIFICAÇÃO</span></div><h2>Seu código de entrada</h2><p>Enviamos os seis números para <strong>{email}</strong>.</p><label className="otp-label" htmlFor="cinecar-otp">Código de acesso</label><div className="otp-entry"><input id="cinecar-otp" className="otp-input" type="text" inputMode="numeric" autoComplete="one-time-code" maxLength={6} pattern="[0-9]{6}" value={code} onChange={e=>setCode(e.target.value.replace(/\D/g,"").slice(0,6))} onKeyDown={e=>{if(e.key==="Enter")void verify();}} aria-label="Código de acesso de seis números" autoFocus/><div className="otp-digits" aria-hidden="true">{Array.from({length:6},(_,i)=><span key={i} className={code[i]?"filled":i===code.length?"next":""}>{code[i]||""}</span>)}</div></div><span className="otp-hint">Digite ou cole o código recebido por e-mail</span>{message&&<p className="error" role="status">{message}</p>}<button className="primary-button enter-button" disabled={busy||code.length!==6} onClick={()=>void verify()}>{busy?<LoaderCircle className="spin" size={17}/>:<Check size={17}/>} Confirmar entrada</button><div className="verify-actions"><button type="button" disabled={busy||clock-codeSentAt<60000} onClick={()=>void resend()}>{clock-codeSentAt<60000?`Reenviar em ${Math.ceil((60000-(clock-codeSentAt))/1000)}s`:"Reenviar código"}</button><button type="button" onClick={()=>{setMessage("");setScreen("welcome");}}>Trocar e-mail</button></div><small className="privacy-note">O código é de uso único. Não compartilhe com outras pessoas.</small></div></section>}

    {screen==="date"&&<section className="content">
      <Steps step={step}/>
      <div className="date-head"><div><div className="eyebrow"><CloudRain size={15}/> PLANEJE UMA NOITE CHUVOSA</div><h1>Qual dia combina<br/>com <em>cinema no carro?</em></h1><p className="lead">Escolha uma data chuvosa. Depois, o grupo vota no filme e combina o que cada um vai levar.</p></div>
       <div className="hero-car"><img src="/car-rain.png" alt="Carro sob chuva com um tablet brilhando"/><span>O cinema está logo ali.</span></div></div>
      <div className="weather-panel">
        <div className="weather-controls"><div className="weather-title"><span><MapPin size={20}/></span><div><h2>Onde vai ser a sessão?</h2><p>Buscamos o tempo para a cidade do encontro</p></div></div>
          <form className="city-search" onSubmit={e=>{e.preventDefault();void loadWeather();}}><label className="sr-only" htmlFor="city">Cidade</label><input id="city" value={city} onChange={e=>setCity(e.target.value)} placeholder="Ex.: Pelotas, RS"/><button disabled={weatherBusy}>{weatherBusy?<LoaderCircle className="spin" size={17}/>:<ArrowRight size={17}/>} Buscar</button></form></div>
        {place&&<p className="place"><MapPin size={13}/>{place.name}{place.admin1?", "+place.admin1:""} · {place.country}</p>}
        <div className="weather-note"><Sparkles size={15}/><span>Mostramos apenas dias com sinal de chuva na previsão atual dos próximos 16 dias. A previsão pode mudar.</span></div>
        {weatherBusy&&<div className="weather-loading"><LoaderCircle className="spin"/> Consultando o céu de {city}…</div>}
        {weatherError&&!weatherBusy&&<p className="weather-error">{weatherError} <button onClick={()=>void loadWeather()}><RefreshCw size={13}/> tentar de novo</button></p>}
        {actual.length>0&&<WeatherGroup title="Chuva na previsão" caption="próximos 16 dias" days={actual} disabled={busy} onChoose={selectDate}/>}
        {message&&<p className="error">{message}</p>}<p className="credit">Previsão: Open-Meteo <span>·</span> compartilhe o convite do topo</p>
      </div>
    </section>}

    {screen==="movies"&&<section className="content"><Steps step={step}/>
      <div className="section-head"><div><div className="eyebrow"><Film size={15}/> PRÓXIMA SESSÃO</div><h1>Qual filme vai pra tela?</h1><p className="lead">{board?.session?.selectedDate?dateText(board.session.selectedDate,{weekday:"long",day:"numeric",month:"long"}):"Data escolhida"}{board?.session?.city?" · "+board.session.city:""}. Escolha um favorito.</p></div><div className="counter"><Users size={16}/><b>{board?.totalVotes||0}<small> / 3 votos</small></b><Progress value={Math.min(100,((board?.totalVotes||0)/3)*100)}/></div></div>
      <Tabs value={genre} onValueChange={setGenre}><TabsList className="genre-tabs">{activeGenres.map(g=><TabsTrigger key={g} value={g}>{g}</TabsTrigger>)}</TabsList>
      {activeGenres.map(g=><TabsContent key={g} value={g} className="film-grid">{films.filter(f=>f.genre===g).map(f=><article className={"film-card "+f.tone+(filmId===f.id?" selected-film":"")} key={f.id}>
        <button className="poster" onClick={()=>setFilmDetails(f)} aria-label={"Ler sinopse de "+f.title}>{(f.poster||posters[(f.wiki||"").toLowerCase()])?<img src={f.poster||posters[(f.wiki||"").toLowerCase()]} alt={"Imagem de "+f.title} loading="lazy"/>:<span className="poster-fallback">{f.emoji}<b>{f.title}</b></span>}<i>▶</i></button>
        <div className="film-info"><span>{f.genre} · {f.year}</span><h3>{f.title}</h3><button className="text-button" onClick={()=>setFilmDetails(f)}>ler sinopse <ArrowRight size={13}/></button><button className={"vote-choice"+(filmId===f.id?" active":"")} onClick={()=>{setFilmId(f.id);setMessage("");}}>{filmId===f.id?<><Check size={15}/> meu voto</>:<><Star size={14}/> votar neste</>}</button></div>
      </article>)}</TabsContent>)}</Tabs>
      <div className="vote-box"><div><strong>{picked?picked.emoji+" "+picked.title:"Seu voto fica por aqui"}</strong><small>{picked?"O placar fecha automaticamente ao chegar a três votos.":"Escolha um filme acima para registrar o voto."}</small></div><div className="vote-identity"><Avatar id={avatar} small/><span>Voto de <b>{characters.find(c=>c.id===avatar)?.name}</b></span></div><button className="primary-button" disabled={busy||!filmId} onClick={()=>void submitVote()}>{busy?<LoaderCircle className="spin"/>:<Ticket size={17}/>} Registrar meu voto <ArrowRight size={15}/></button></div>
      {message&&<p className="error">{message}</p>}<p className="fine"><i/> A votação fecha automaticamente quando chegarem 3 votos.</p>
    </section>}

    {screen==="ticket"&&<section className="content narrow"><Steps step={step}/><div className="ticket-intro"><div className="eyebrow"><Ticket size={15}/> INGRESSO SOLIDÁRIO</div><h1>Seu ingresso é<br/><em>o que você traz.</em></h1><p className="lead">Escolha seu papel na sessão. Cada opção inclui uma comidinha para dividir. Escolha o que combina com você.</p></div>
      <RadioGroup value={ticketId} onValueChange={setTicketId} className="ticket-list">{tickets.map((t,i)=><label key={t.id} className={"ticket-option"+(ticketId===t.id?" chosen":"")}><RadioGroupItem value={t.id} id={"tk-"+t.id}/><span className="ticket-emoji">{t.emoji}</span><span className="ticket-copy"><small>CINECAR · ADMISSÃO 0{i+1}</small><b>{t.title}</b><span>{t.bring}</span><i>{t.note}</i></span><span className="ticket-stub"><small>SEU LUGAR</small><b>{t.code}</b><span className="barcode"/></span><span className="ticket-check">{ticketId===t.id?<Check size={16}/>:null}</span></label>)}</RadioGroup>
      {message&&<p className="error">{message}</p>}<div className="ticket-actions"><button className="text-button" onClick={()=>setScreen("movies")}><ArrowLeft size={15}/> trocar meu voto</button><button className="primary-button" disabled={busy||!ticketId} onClick={()=>void submitTicket()}>{busy?<LoaderCircle className="spin"/>:<Ticket size={17}/>} Confirmar ingresso <ArrowRight size={15}/></button></div>
    </section>}

    {screen==="waiting"&&<section className="content waiting"><div className="eyebrow centered"><MoonStar size={15}/> LUZES BAIXAS, VOTAÇÃO ABERTA</div><h1>Seu lugar está<br/><em>reservado.</em></h1><p className="lead centered">É só esperar mais amigos escolherem. Quando chegarem 3 votos, o filme aparece aqui.</p>
      <div className="wait-progress"><strong>{board?.totalVotes||0}<small> / 3 votos</small></strong><Progress value={Math.min(100,((board?.totalVotes||0)/3)*100)}/><span>{[0,1,2].map(i=><i className={i<(board?.totalVotes||0)?"filled":""} key={i}>{i<(board?.totalVotes||0)?"✓":"·"}</i>)}</span></div>
      <p className="refreshing"><i/> placar atualiza sozinho</p><div className="invite-actions"><button className="outline-button" onClick={invite}><Share2 size={15}/> chamar mais alguém</button><button className="outline-button" onClick={()=>void sync(sessionId)}><RefreshCw size={14}/> atualizar</button></div>
      <VoterStatus votes={board?.votes||[]}/>{share&&<p className="share-toast">{share}</p>}
    </section>}

    {screen==="result"&&<section className="content result result-fit">
      <div className="result-top"><div><div className="eyebrow"><Sparkles size={15}/> ESCOLHA FEITA · {board?.totalVotes||0} VOTOS</div><h1>A sessão é <em>{winner?.title||"surpresa!"}</em></h1><p>{board?.session?.selectedDate?dateText(board.session.selectedDate,{weekday:"long",day:"numeric",month:"long"}):""}{board?.session?.city?" · "+board.session.city:""}</p></div><div className="result-actions"><button className="primary-button" onClick={invite}><Share2 size={15}/> Compartilhar</button><a className="outline-button" href="/admin"><KeyRound size={14}/> Painel</a></div></div>
      <div className="result-layout"><div className="result-feature">
        {board?.session?.driveFileId?<div className="drive-frame"><iframe title={"Assistir "+(winner?.title||"filme")+" no Google Drive"} src={"https://drive.google.com/file/d/"+encodeURIComponent(board.session.driveFileId)+"/preview"+(board.session.driveResourceKey?"?resourcekey="+encodeURIComponent(board.session.driveResourceKey):"")} allow="autoplay; fullscreen; picture-in-picture" allowFullScreen/></div>:<div className="result-presentation">{winner&&<div className="result-poster">{(winner.poster||posters[(winner.wiki||"").toLowerCase()])?<img src={winner.poster||posters[(winner.wiki||"").toLowerCase()]} alt={"Cartaz de "+winner.title}/>:<span>{winner.emoji}</span>}</div>}<div><span className="result-label">AGUARDANDO O PROJETOR</span><h2>Pronto para a sessão</h2><p>O filme já foi escolhido. O host pode liberar o vídeo do Drive aqui depois da votação.</p></div></div>}
        <div className="result-under-player"><span>{board?.session?.driveFileId?"▶ Reprodução pelo Google Drive":"🎬 Filme escolhido pelo grupo"}</span><div>{winner&&<a href={winner.trailer} target="_blank" rel="noreferrer">Trailer <ExternalLink size={13}/></a>}{board?.session?.driveFileId&&<a href={"https://drive.google.com/file/d/"+encodeURIComponent(board.session.driveFileId)+"/view"+(board.session.driveResourceKey?"?resourcekey="+encodeURIComponent(board.session.driveResourceKey):"")} target="_blank" rel="noreferrer">Abrir no Drive <ExternalLink size={13}/></a>}</div></div>
      </div><aside className="result-sidebar"><h2>O grupo</h2><VoterStatus votes={board?.votes||[]}/><div className="roster"><div className="roster-title"><h3>Quem leva o quê</h3><span>{board?.votes.length||0} lugares</span></div>{board?.votes.map(v=>{const item=tickets.find(t=>t.id===v.ticketId);const movie=films.find(f=>f.id===v.filmId);return <div className="roster-row" key={v.voterId}><Avatar id={v.avatar} small/><span><strong>{v.name}</strong><small>votou em {movie?.title}</small></span><i>{item?.emoji||"🎟️"} {item?.title||"ingresso pendente"}</i></div>;})}</div></aside></div>
      {share&&<p className="share-toast">{share}</p>}
    </section>}

    <footer className="footer"><strong>CineCar ✦</strong><span>um cinema pequeno, uma noite gigante</span><span>feito para amigos & dias de chuva</span></footer>
    {share&&screen==="date"&&<div className="share-toast">{share}</div>}

    <Dialog open={Boolean(filmDetails)} onOpenChange={open=>{if(!open)setFilmDetails(null);}}>
      <DialogContent className="film-dialog">{filmDetails&&<><DialogHeader><small>{filmDetails.genre} · {filmDetails.year}</small><DialogTitle>{filmDetails.title}</DialogTitle><DialogDescription>{filmDetails.synopsis}</DialogDescription></DialogHeader><div className="dialog-poster">{(filmDetails.poster||posters[(filmDetails.wiki||"").toLowerCase()])?<img src={filmDetails.poster||posters[(filmDetails.wiki||"").toLowerCase()]} alt={"Imagem de "+filmDetails.title}/>:filmDetails.emoji}</div><div className="dialog-actions"><a className="outline-button" href={filmDetails.trailer} target="_blank" rel="noreferrer">▶ Assistir trailer <ExternalLink size={14}/></a><button className="primary-button" onClick={()=>{setFilmId(filmDetails.id);setFilmDetails(null);}}><Star size={15}/> votar neste filme</button></div></>}</DialogContent>
    </Dialog>
  </main>;
}

function Steps({step,back}:{step:number;back?:()=>void}) {
  const names=["Dia da sessão","Filme","Ingresso"];
  return <div className="steps">{back&&<button className="back" onClick={back}><ArrowLeft size={14}/> voltar</button>}{names.map((n,i)=><span className={(i+1===step?"active ":i+1<step?"done ":"")} key={n}><b>{String(i+1).padStart(2,"0")}</b>{n}</span>)}<small>────</small></div>;
}
function WeatherGroup({title,caption,days,disabled,onChoose}:{title:string;caption:string;days:Day[];disabled:boolean;onChoose:(day:Day)=>void}) {
  return <div className="weather-group"><div className="group-title"><h3><CloudRain size={18}/>{title}</h3><small>{caption}</small></div><div className="weather-grid">{days.map(day=><button className={"weather-day"+(day.historic?" historical":"")} key={day.date} disabled={disabled} onClick={()=>onChoose(day)}><span>{dateText(day.date)}</span><CloudRain size={21}/><b>{day.historic?day.chance+"%":day.chance===null?Math.round(day.rain)+" mm":day.chance+"%"}</b><small>{day.historic?"chuva em anos passados":day.rain>=5?"Chuva forte":"Chuva prevista"}</small></button>)}</div></div>;
}

function VoterStatus({votes}:{votes:Vote[]}) {
  return <div className="voter-status" aria-label="Status dos votos">{characters.map(c=>{const voted=votes.some(v=>v.avatar===c.id);return <div className={"voter-person"+(voted?" has-voted":"")} key={c.id}><Avatar id={c.id}/><strong>{c.name}</strong><span>{voted?<><Check size={13}/> votou</>:"não votou"}</span></div>;})}</div>;
}
