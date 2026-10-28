# 🔁 Reverso

Jogo do áudio ao contrário: ouça o nome de um famoso brasileiro **de trás pra frente**, grave você imitando o som e o jogo **desvira** sua gravação — aí o nome aparece!

- **Clássico:** 10 famosos. Acertou só ouvindo ao contrário = 10 pts · depois de gravar = 6 pts · cada dica −3 · sequência dá bônus de até +5.
- **Fácil** (escolher entre 4 nomes) ou **Difícil** (digitar o nome, pontos x2).
- **Desafio do Dia:** 5 nomes iguais pra todo mundo, resultado compartilhável com emojis.
- **Modo Festa:** uma pessoa grava qualquer nome, a outra tenta adivinhar ao contrário.
- PWA instalável (iPhone, Android, desktop), funciona offline.

## Rodar local
```
py -m http.server 5180   # ou: npx serve .
```

## Adicionar nomes
Edite `data/names.json` e rode (gera as vozes grátis com edge-tts, pt-BR neural):
```
py -m pip install edge-tts
py scripts/gen_audio.py
```
Depois aumente `AUDIO_V` em `js/app.js` e `VERSION` em `sw.js` para os celulares pegarem os áudios novos.

Vozes: só Antonio e Francisca (pt-BR). Cada nome pode fixar a voz com `"v": "A"` ou `"F"` no `names.json` — escolhemos a que o Whisper reconhece melhor depois do corte de silêncio.

## Deploy
Site estático, sem build. No Vercel: importar o repositório, framework **Other**, sem comando de build.
