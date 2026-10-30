// Service worker do Kout (etapas 4 e 4b).
// Faz duas coisas: quando a internet cai, mostra a tela "Você está sem internet" em
// vez do erro do navegador; e mostra as notificações que chegam pelo push. Nenhum dado
// de aluno, agenda ou cobrança fica guardado no aparelho (LGPD).
const VERSAO = "kout-v1";
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

// Notificação recebida (etapa 4b): { titulo, corpo, url }.
self.addEventListener("push", (evento) => {
  let dados = {};
  try {
    dados = evento.data ? evento.data.json() : {};
  } catch {
    dados = { corpo: evento.data ? evento.data.text() : "" };
  }
  evento.waitUntil(
    self.registration.showNotification(dados.titulo || "Kout", {
      body: dados.corpo || "",
      icon: "/icones/icone-192.png",
      badge: "/icones/icone-192.png",
      data: { url: dados.url || "/inicio" },
    }),
  );
});

// Toque na notificação: abre (ou traz para a frente) o Kout na tela certa.
self.addEventListener("notificationclick", (evento) => {
  evento.notification.close();
  const destino = new URL(evento.notification.data?.url || "/inicio", self.location.origin).href;
  evento.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((janelas) => {
      const aberta = janelas.find((j) => j.url.startsWith(self.location.origin));
      if (aberta) return aberta.focus().then(() => aberta.navigate(destino));
      return self.clients.openWindow(destino);
    }),
  );
});
