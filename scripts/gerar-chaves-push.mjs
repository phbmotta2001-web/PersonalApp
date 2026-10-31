// Gera as chaves das notificações (etapa 4b) e grava no .env.local, sem mostrar os valores.
//   node scripts/gerar-chaves-push.mjs
// Se o .env.local já tiver as chaves, não mexe (trocar as chaves desliga as
// notificações de todos os aparelhos já inscritos).

import { randomBytes } from "node:crypto";
import fs from "node:fs";
import webpush from "web-push";

const ARQUIVO = ".env.local";
if (!fs.existsSync(ARQUIVO)) {
  console.error("Não achei o .env.local. Rode este comando na pasta do projeto (pbell-app).");
  process.exit(1);
}

const atual = fs.readFileSync(ARQUIVO, "utf8");
const tem = (nome) => new RegExp(`^${nome}=.+`, "m").test(atual);
if (tem("NEXT_PUBLIC_VAPID_PUBLIC_KEY") && tem("VAPID_PRIVATE_KEY") && tem("PUSH_SEGREDO")) {
  console.log("O .env.local já tem as três chaves das notificações. Nada foi mudado.");
  process.exit(0);
}

const { publicKey, privateKey } = webpush.generateVAPIDKeys();
const segredo = randomBytes(32).toString("hex");
// Tira linhas vazias das três (se existirem) e acrescenta as novas no fim.
const limpo = atual
  .split(/\r?\n/)
  .filter((l) => !/^(NEXT_PUBLIC_VAPID_PUBLIC_KEY|VAPID_PRIVATE_KEY|PUSH_SEGREDO)=/.test(l))
  .join("\n")
  .trimEnd();
fs.writeFileSync(
  ARQUIVO,
  `${limpo}\n\n# Notificações no celular (geradas por scripts/gerar-chaves-push.mjs)\n` +
    `NEXT_PUBLIC_VAPID_PUBLIC_KEY=${publicKey}\nVAPID_PRIVATE_KEY=${privateKey}\nPUSH_SEGREDO=${segredo}\n`,
);
console.log("Pronto: as três chaves das notificações foram gravadas no .env.local.");
console.log("Próximo passo: copiar as três para a Vercel (os valores estão no .env.local).");
