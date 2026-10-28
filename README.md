# 🔁 Reverso

Jogo do áudio ao contrário: ouça o nome de um famoso brasileiro **de trás pra frente**, grave você imitando o som e o jogo **desvira** sua gravação — aí o nome aparece!

- **Clássico:** 10 famosos. Acertou só ouvindo ao contrário = 10 pts · depois de gravar = 6 pts · dica −3 · sequência dá bônus de até +5.
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
Depois aumente `VERSION` em `sw.js` para os celulares pegarem a atualização.

## Deploy
Site estático, sem build. No Vercel: importar o repositório, framework **Other**, sem comando de build.
