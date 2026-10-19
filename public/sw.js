// Service worker do Pienel (etapa 4).
// Só faz uma coisa: quando a internet cai, mostra a tela "Você está sem internet"
// em vez do erro do navegador. Nenhum dado de aluno, agenda ou cobrança fica guardado
// no aparelho: tudo continua vindo do servidor (LGPD).
const VERSAO = "pienel-v1";
const SEM_INTERNET = "/offline.html";

self.addEventListener("install", (evento) => {
  evento.waitUntil(
    caches.open(VERSAO).then((cache) => cache.addAll([SEM_INTERNET, "/icones/icone-192.png"])),
  );
  self.skipWaiting();
});

self.addEventListener("activate", (evento) => {
  evento.waitUntil(
    caches
      .keys()
      .then((nomes) => Promise.all(nomes.filter((n) => n !== VERSAO).map((n) => caches.delete(n))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (evento) => {
  // Só as aberturas de página; o resto (dados, imagens, ações) segue direto para a rede.
  if (evento.request.mode !== "navigate") return;
  evento.respondWith(fetch(evento.request).catch(() => caches.match(SEM_INTERNET)));
});
