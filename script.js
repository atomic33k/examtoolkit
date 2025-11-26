/* Simple A-Level Study Hub
   - Uses localStorage as backend
   - Subjects: A Level Maths (OCR), Computer Science (OCR), Economics (Edexcel)
   - Features: notes, create MCQ quizzes, play quizzes, flashcards, progress tracking
*/

const SUBJECTS = [
  { id: "maths-ocr", name: "A Level Maths (OCR)" },
  { id: "cs-ocr", name: "A Level Computer Science (OCR)" },
  { id: "econ-edx", name: "A Level Economics (Edexcel)" }
];

// --- Helpers for storage ---
function getStore(key, fallback) {
  try {
    return JSON.parse(localStorage.getItem(key)) || fallback;
  } catch(e) { return fallback; }
}
function setStore(key, val) {
  localStorage.setItem(key, JSON.stringify(val));
}

// Initialize storage objects if missing
if (!localStorage.getItem("studyhub_data")) {
  const init = { subjects: {}, progress: {} };
  SUBJECTS.forEach(s => init.subjects[s.id] = { notes: [], quizzes: [], decks: [], pastpapers: [] });
  SUBJECTS.forEach(s => init.progress[s.id] = { attempts: 0, correct: 0, mastery: 0 });
  setStore("studyhub_data", init);
}

let data = getStore("studyhub_data", { subjects: {}, progress: {} });

// --- Simple "AI" utilities (local heuristics) ---
function simpleSummary(text, maxSentences=4) {
  if (!text) return "";
  const sents = text.replace(/\n+/g," ").split(/(?<=[.!?])\s+/).filter(Boolean);
  return sents.slice(0,maxSentences).join(" ");
}
function extractTopicsFromText(text) {
  // naive: return top 6 longest unique words (not great but useful)
  if (!text) return [];
  const words = text.toLowerCase().replace(/[^a-z0-9\s]/g," ").split(/\s+/).filter(w => w.length>3);
  const uniq = [...new Set(words)];
  uniq.sort((a,b)=> b.length - a.length);
  return uniq.slice(0,6);
}

// --- UI bindings ---
const pages = {
  home: document.getElementById("page-home"),
  subjects: document.getElementById("page-subjects"),
  subject: document.getElementById("page-subject"),
  quizplayer: document.getElementById("page-quizplayer"),
  flashstudy: document.getElementById("page-flashstudy"),
  progress: document.getElementById("page-progress")
};

function showPage(name) {
  Object.values(pages).forEach(el => el.classList.add("hidden"));
  pages[name].classList.remove("hidden");
  currentPage = name;
}
let currentSubject = null;
let currentPage = "home";

document.querySelectorAll(".nav-btn").forEach(b => {
  b.addEventListener("click", () => showPage(b.dataset.page));
});
document.querySelectorAll("[data-page]").forEach(b => {
  b.addEventListener("click", () => showPage(b.dataset.page));
});

// populate subjects list
function renderSubjectsList(){
  const container = document.getElementById("subjects-list");
  container.innerHTML = "";
  SUBJECTS.forEach(s => {
    const card = document.createElement("div");
    card.className = "card";
    card.innerHTML = `<h3>${s.name}</h3>
      <p class="muted">Study resources, notes, quizzes & flashcards for ${s.name}.</p>
      <div class="row">
        <button class="open-sub" data-id="${s.id}">Open</button>
        <button class="view-prog" data-id="${s.id}">Progress</button>
      </div>`;
    container.appendChild(card);
  });

  document.querySelectorAll(".open-sub").forEach(b => {
    b.addEventListener("click", e => {
      openSubject(e.target.dataset.id);
    });
  });
  document.querySelectorAll(".view-prog").forEach(b => {
    b.addEventListener("click", e => {
      showPage("progress");
      renderProgressList(e.target.dataset.id);
    });
  });
}

function openSubject(id){
  currentSubject = id;
  const subj = SUBJECTS.find(s=>s.id===id);
  document.getElementById("subject-title").innerText = subj.name;
  renderSubjectNotes();
  renderQuizzes();
  renderDeck();
  renderPastPapers();
  showPage("subject");
}

document.getElementById("back-to-subjects").addEventListener("click", ()=> showPage("subjects"));

// Notes actions
document.getElementById("save-notes").addEventListener("click", () => {
  const txt = document.getElementById("notes-input").value.trim();
  if (!txt) return alert("Add some notes first.");
  data.subjects[currentSubject].notes.unshift({ id:Date.now(), text: txt, created: new Date().toISOString() });
  setStore("studyhub_data", data);
  document.getElementById("notes-input").value = "";
  renderSubjectNotes();
});
document.getElementById("auto-summary").addEventListener("click", () => {
  const txt = document.getElementById("notes-input").value.trim();
  if (!txt) return alert("Paste notes first.");
  const s = simpleSummary(txt, 3);
  document.getElementById("notes-input").value = s;
});
document.getElementById("download-notes").addEventListener("click", () => {
  const txt = document.getElementById("notes-input").value.trim();
  if (!txt) return alert("No notes to download.");
  const blob = new Blob([txt], {type:"text/plain"});
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = `${currentSubject}-notes.txt`;
  a.click();
});
function renderSubjectNotes(){
  const list = document.getElementById("notes-list");
  list.innerHTML = "";
  const notes = data.subjects[currentSubject].notes || [];
  notes.slice(0,8).forEach(n => {
    const el = document.createElement("div");
    el.className = "note";
    el.style.marginTop="8px";
    el.innerHTML = `<strong>${new Date(n.created).toLocaleString()}</strong>
      <p>${n.text.substring(0,300)}</p>
      <div class="row"><button class="view-note" data-id="${n.id}">View</button><button class="del-note" data-id="${n.id}">Delete</button></div>`;
    list.appendChild(el);
  });
  list.querySelectorAll(".view-note").forEach(b=>b.addEventListener("click", e=>{
    const id = e.target.dataset.id;
    const n = data.subjects[currentSubject].notes.find(x=>x.id==id);
    if(n) alert(n.text);
  }));
  list.querySelectorAll(".del-note").forEach(b=>b.addEventListener("click", e=>{
    const id = e.target.dataset.id;
    data.subjects[currentSubject].notes = data.subjects[currentSubject].notes.filter(x=>x.id!=id);
    setStore("studyhub_data", data);
    renderSubjectNotes();
  }));
}

// Quiz creation
document.getElementById("create-quiz").addEventListener("click", ()=>{
  const title = document.getElementById("quiz-title").value.trim() || "Untitled Quiz";
  const raw = document.getElementById("quiz-questions").value.trim();
  if(!raw) return alert("Add questions following the format.");
  // parse lines
  const lines = raw.split("\n").map(l=>l.trim()).filter(Boolean);
  const qs = [];
  lines.forEach(line=>{
    // expected: Question? | correct answer | wrong1 ; wrong2 ; wrong3
    const parts = line.split("|").map(p=>p.trim());
    if(parts.length < 2) return;
    const qtext = parts[0];
    const correct = parts[1];
    const wrong = (parts[2] || "").split(";").map(w=>w.trim()).filter(Boolean);
    const choices = [correct, ...wrong].slice(0,4);
    // fill up with simple variants if missing
    while(choices.length < 4) choices.push("N/A");
    // shuffle choices
    for (let i = choices.length -1; i>0; i--) {
      const j = Math.floor(Math.random()*(i+1));
      [choices[i], choices[j]] = [choices[j], choices[i]];
    }
    qs.push({ id:Date.now()+Math.random(), q:qtext, choices: choices, answer: correct });
  });
  if(qs.length===0) return alert("No valid questions parsed. Use the format: Question? | correct | wrong1 ; wrong2 ; wrong3");
  const quiz = { id:Date.now(), title, questions: qs };
  data.subjects[currentSubject].quizzes.unshift(quiz);
  setStore("studyhub_data", data);
  document.getElementById("quiz-title").value="";
  document.getElementById("quiz-questions").value="";
  renderQuizzes();
  alert("Quiz saved! Click Start Quiz to play.");
});

document.getElementById("start-quiz").addEventListener("click", ()=>{
  const list = data.subjects[currentSubject].quizzes;
  if(!list || list.length===0) return alert("No quizzes. Create one first.");
  startQuiz(list[0].id); // start most recent quiz
});

function renderQuizzes(){
  const container = document.getElementById("quizzes-list");
  container.innerHTML = "<h4>Saved quizzes</h4>";
  const list = data.subjects[currentSubject].quizzes || [];
  if(list.length===0){ container.innerHTML += "<p class='muted'>No quizzes yet.</p>"; return; }
  list.slice(0,6).forEach(q=>{
    const el = document.createElement("div");
    el.style.marginTop="8px";
    el.innerHTML = `<strong>${q.title}</strong><div class="row"><button class="play-quiz" data-id="${q.id}">Play</button><button class="del-quiz" data-id="${q.id}">Delete</button></div>`;
    container.appendChild(el);
  });
  container.querySelectorAll(".play-quiz").forEach(b=>b.addEventListener("click", e=> startQuiz(e.target.dataset.id)));
  container.querySelectorAll(".del-quiz").forEach(b=>b.addEventListener("click", e=>{
    data.subjects[currentSubject].quizzes = data.subjects[currentSubject].quizzes.filter(x=>x.id!=e.target.dataset.id);
    setStore("studyhub_data", data);
    renderQuizzes();
  }));
}

// Quiz player
function startQuiz(quizId){
  const subjQuizzes = data.subjects[currentSubject].quizzes || [];
  const quiz = subjQuizzes.find(q=>q.id==quizId);
  if(!quiz) return alert("Quiz not found");
  showPage("quizplayer");
  document.getElementById("quizplayer-title").innerText = quiz.title;
  const area = document.getElementById("quiz-area");
  area.innerHTML = "";
  let score = 0;
  let idx = 0;
  function renderQuestion(){
    area.innerHTML = "";
    if(idx >= quiz.questions.length){
      // finish
      area.innerHTML = `<h3>Quiz complete</h3><p>Your score: ${score} / ${quiz.questions.length}</p><div class="row"><button id="finish-quiz">Finish</button><button id="retry-quiz">Retry</button></div>`;
      document.getElementById("finish-quiz").addEventListener("click", ()=>{
        // update progress
        data.progress[currentSubject].attempts += quiz.questions.length;
        data.progress[currentSubject].correct += score;
        data.progress[currentSubject].mastery = Math.round((data.progress[currentSubject].correct / (data.progress[currentSubject].attempts || 1)) * 100);
        setStore("studyhub_data", data);
        showPage("subject");
      });
      document.getElementById("retry-quiz").addEventListener("click", ()=>{
        score = 0; idx = 0; renderQuestion();
      });
      return;
    }
    const q = quiz.questions[idx];
    const qdiv = document.createElement("div");
    qdiv.innerHTML = `<h3>Q${idx+1}: ${q.q}</h3>`;
    q.choices.forEach((c,i)=>{
      const btn = document.createElement("button");
      btn.innerText = c;
      btn.style.marginTop="8px";
      btn.addEventListener("click", ()=>{
        if (c === q.answer) { score++; alert("Correct!"); }
        else alert("Wrong! Answer: " + q.answer);
        idx++; renderQuestion();
      });
      qdiv.appendChild(btn);
    });
    area.appendChild(qdiv);
  }
  renderQuestion();
}
document.getElementById("back-from-quiz").addEventListener("click", ()=> showPage("subject"));

// --- Flashcards ---
document.getElementById("add-card").addEventListener("click", ()=>{
  const front = document.getElementById("card-front").value.trim();
  const back = document.getElementById("card-back").value.trim();
  if(!front || !back) return alert("Fill both front and back.");
  const decks = data.subjects[currentSubject].decks || [];
  if(!decks[0]) decks[0] = { id: Date.now(), name: "Default deck", cards: [] };
  decks[0].cards.unshift({ id: Date.now()+Math.random(), front, back, nextDue: Date.now(), interval: 1, ease: 2.5 });
  data.subjects[currentSubject].decks = decks;
  setStore("studyhub_data", data);
  document.getElementById("card-front").value=""; document.getElementById("card-back").value="";
  renderDeck();
});

document.getElementById("study-cards").addEventListener("click", ()=> startFlashStudy());

function renderDeck(){
  const list = document.getElementById("deck-list");
  list.innerHTML = "<h4>Decks</h4>";
  const decks = data.subjects[currentSubject].decks || [];
  if(decks.length===0){ list.innerHTML += "<p class='muted'>No flashcards yet.</p>"; return; }
  decks.forEach(d=>{
    const el = document.createElement("div");
    el.style.marginTop="8px";
    el.innerHTML = `<strong>${d.name}</strong><p class="muted">${d.cards.length} cards</p>`;
    list.appendChild(el);
  });
}

// Simple spaced repetition: schedule nextDue = now + interval*dayFactor; interval increases if rated good.
function startFlashStudy(){
  const decks = data.subjects[currentSubject].decks || [];
  if(!decks[0] || decks[0].cards.length===0) return alert("No cards to study.");
  showPage("flashstudy");
  document.getElementById("flash-title").innerText = `Studying: ${SUBJECTS.find(s=>s.id===currentSubject).name}`;
  const area = document.getElementById("flash-area");
  const cards = decks[0].cards;
  let pos = 0;
  function showCard(){
    if(pos >= cards.length) {
      area.innerHTML = `<p>Session complete.</p><div class="row"><button id="back-to-sub">Back</button></div>`;
      document.getElementById("back-to-sub").addEventListener("click", ()=> showPage("subject"));
      return;
    }
    const c = cards[pos];
    area.innerHTML = `<div><h3>${c.front}</h3><p class="muted">Flip to see answer</p><div class="row"><button id="flip">Flip</button><button id="skip">Skip</button></div></div>`;
    document.getElementById("flip").addEventListener("click", ()=>{
      area.innerHTML = `<div><h3>${c.front}</h3><p><strong>${c.back}</strong></p><div class="row"><button id="easy">Easy</button><button id="good">Good</button><button id="hard">Hard</button></div></div>`;
      document.getElementById("easy").addEventListener("click", ()=> { rateCard(4); });
      document.getElementById("good").addEventListener("click", ()=> { rateCard(3); });
      document.getElementById("hard").addEventListener("click", ()=> { rateCard(1); });
    });
    document.getElementById("skip").addEventListener("click", ()=> { pos++; showCard(); });
  }
  function rateCard(score){
    // adjust ease & interval roughly
    const c = cards[pos];
    if(score >= 3){
      c.interval = Math.round(c.interval * (1.6 + (score-3)*0.3));
      c.nextDue = Date.now() + c.interval * 24*3600*1000;
    } else {
      c.interval = 1; c.nextDue = Date.now() + 24*3600*1000;
    }
    pos++;
    setStore("studyhub_data", data);
    showCard();
  }
  showCard();
}

// Past papers
document.getElementById("save-pastpaper").addEventListener("click", ()=>{
  const txt = document.getElementById("pastpaper-text").value.trim();
  if(!txt) return alert("Paste or type the past paper text.");
  data.subjects[currentSubject].pastpapers.unshift({ id: Date.now(), text: txt, created: new Date().toISOString() });
  setStore("studyhub_data", data);
  document.getElementById("pastpaper-text").value="";
  renderPastPapers();
});
document.getElementById("analyze-pastpaper").addEventListener("click", ()=>{
  const txt = document.getElementById("pastpaper-text").value.trim();
  if(!txt) return alert("Paste past paper text first.");
  const topics = extractTopicsFromText(txt);
  alert("Detected topics / keywords:\n\n" + topics.join(", "));
});

function renderPastPapers(){
  const list = document.getElementById("pastpapers-list");
  list.innerHTML = "<h4>Saved past papers</h4>";
  const papers = data.subjects[currentSubject].pastpapers || [];
  if(papers.length===0){ list.innerHTML += "<p class='muted'>No past papers saved.</p>"; return; }
  papers.slice(0,6).forEach(p=>{
    const el = document.createElement("div"); el.style.marginTop="8px";
    el.innerHTML = `<strong>${new Date(p.created).toLocaleString()}</strong><div class="row"><button class="view-paper" data-id="${p.id}">View</button><button class="del-paper" data-id="${p.id}">Delete</button></div>`;
    list.appendChild(el);
  });
  list.querySelectorAll(".view-paper").forEach(b=>b.addEventListener("click", e=>{
    const p = data.subjects[currentSubject].pastpapers.find(x=>x.id==e.target.dataset.id);
    if(p) alert(p.text);
  }));
  list.querySelectorAll(".del-paper").forEach(b=>b.addEventListener("click", e=>{
    data.subjects[currentSubject].pastpapers = data.subjects[currentSubject].pastpapers.filter(x=>x.id!=e.target.dataset.id);
    setStore("studyhub_data", data);
    renderPastPapers();
  }));
}

// Progress page
function renderProgressList(filterSubject){
  const container = document.getElementById("progress-list");
  container.innerHTML = "";
  const prog = data.progress;
  const keys = filterSubject ? [filterSubject] : Object.keys(prog);
  keys.forEach(k=>{
    const subj = SUBJECTS.find(s=>s.id===k);
    const p = prog[k];
    const card = document.createElement("div");
    card.className = "card";
    card.innerHTML = `<h3>${subj.name}</h3>
      <p>Attempts: ${p.attempts} • Correct: ${p.correct} • Mastery: ${p.mastery || 0}%</p>
      <div class="progress-bar"><i style="width:${p.mastery || 0}%;"></i></div>
      <div style="margin-top:8px;"><button class="reset-prog" data-id="${k}">Reset</button></div>`;
    container.appendChild(card);
  });
  container.querySelectorAll(".reset-prog").forEach(b=>b.addEventListener("click", e=>{
    if(!confirm("Reset progress for this subject?")) return;
    data.progress[e.target.dataset.id] = { attempts:0, correct:0, mastery:0 };
    setStore("studyhub_data", data);
    renderProgressList();
  }));
}

// initial render
renderSubjectsList();
showPage("home");
