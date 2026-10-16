/* ===== BATAILLE DES ALLIÉS : traductions (même système que Cube Gravity) =====
   Le français est la langue du code : la clé d'un texte, c'est le texte français lui-même.

     BDAi18n.t("Encore {n} coups pour le sans-faute.", {n: 3})
       -> la phrase dans la langue du joueur, ou la phrase française si la traduction manque.

   Une langue = un fichier lang/<code>.js qui appelle BDAi18n.add("<code>", { "texte français": "traduction", ... }).
   Seul le fichier de la langue choisie est chargé. Ajouter une langue : créer son fichier et l'inscrire dans LANGS.

   Choix de la langue : ?lang=xx dans l'adresse, sinon le réglage du joueur (options du menu),
   sinon la langue du téléphone, sinon l'anglais.
   Le texte déjà présent dans la page (boutons, titres) est traduit d'un coup par BDAi18n.apply().
   Les planches de DA (da*.html) restent en français.
*/
(function(){
  const LANGS={fr:"Français",en:"English",es:"Español",de:"Deutsch",pt:"Português",zh:"中文",ja:"日本語",ko:"한국어"};
  const KEY="bda_lang";
  const tables={};
  const missing=new Set(); // clés demandées sans traduction : BDAi18n.missing, pour repérer les oublis

  function detect(){
    const asked=new URLSearchParams(location.search).get("lang");
    if(LANGS[asked])return asked;
    try{const saved=localStorage.getItem(KEY);if(LANGS[saved])return saved;}catch(e){}
    const wanted=navigator.languages&&navigator.languages.length?navigator.languages:[navigator.language||"en"];
    for(const l of wanted){
      const code=String(l).slice(0,2).toLowerCase();
      if(LANGS[code])return code;
    }
    return "en";
  }
  const lang=detect();

  function lookup(key){
    const table=tables[lang];
    return table&&Object.prototype.hasOwnProperty.call(table,key)?table[key]:null;
  }
  function t(key,vars){
    if(!key)return "";
    let s=lang==="fr"?key:lookup(key);
    if(s==null){missing.add(key);s=key;}
    return vars?s.replace(/\{(\w+)\}/g,(m,k)=>k in vars?vars[k]:m):s;
  }
  /* Traduit le texte statique de la page : chaque bout de texte dont la version française est connue. */
  function apply(root){
    document.documentElement.lang=lang;
    if(lang==="fr")return;
    root=root||document.body;
    const skip=n=>!!(n.closest&&n.closest("script,style,[data-no-i18n],[data-i18n]"));
    // Blocs riches (texte + balises) : tout le contenu HTML de l'élément sert de clé, d'un seul tenant.
    root.querySelectorAll("[data-i18n]").forEach(el=>{
      const tr=lookup(el.innerHTML.trim().replace(/\s+/g," "));
      if(tr!=null)el.innerHTML=tr;
    });
    const walker=document.createTreeWalker(root,NodeFilter.SHOW_TEXT);
    const nodes=[];
    while(walker.nextNode())nodes.push(walker.currentNode);
    nodes.forEach(n=>{
      const raw=n.nodeValue,text=raw.trim();
      if(!text||skip(n.parentElement))return;
      const tr=lookup(text);
      if(tr!=null)n.nodeValue=raw.replace(text,tr);
    });
    root.querySelectorAll("[aria-label],[title]").forEach(el=>{
      if(skip(el))return;
      ["aria-label","title"].forEach(a=>{
        const tr=el.hasAttribute(a)?lookup(el.getAttribute(a)):null;
        if(tr!=null)el.setAttribute(a,tr);
      });
    });
  }
  function setLang(code){
    if(!LANGS[code]||code===lang)return;
    try{localStorage.setItem(KEY,code);}catch(e){}
    const url=new URL(location.href);
    url.searchParams.delete("lang");
    location.replace(url.toString());
  }

  window.BDAi18n={lang,LANGS,t,apply,setLang,missing,add(code,table){tables[code]=Object.assign(tables[code]||{},table);}};
  // Chargé tout de suite, avant les scripts du jeu : les textes sont prêts dès leur premier affichage.
  if(lang!=="fr")document.write('<script src="lang/'+lang+'.js?v='+(window.BDA_V||"")+'"><\/script>');
})();
