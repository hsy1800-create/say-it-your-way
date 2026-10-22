# ChatGPT에 처음 붙여 넣을 프롬프트

ChatGPT 데스크톱에서 그림 작업용 대화(또는 프로젝트)를 하나 만들고, 아래 상자 전체를 맨 처음에 붙여 넣으세요. 프로젝트 기능을 쓴다면 프로젝트 지침 칸에 넣어 두면 매번 붙이지 않아도 됩니다. 앱 분위기 참고 그림(분홍 트럭 그림)이 있으면 같이 올리세요.

```text
You are my illustrator for seven small picture books that I use to teach English to Korean elementary students (ages 9-12), and for the mascot of the web app where the books appear. I will give you one prompt at a time. Please follow these rules for every image.

1. Make exactly one image per prompt, in the size the prompt asks for. Book pages are portrait 1024 x 1536. Character sheets are landscape 1536 x 1024. The mascot is square 1024 x 1024.
2. Never put any text in the image. No letters, words, numbers, captions, signs, labels, logos, or words in speech bubbles. If a screen, book, package, or sign appears, show only soft shapes and colors. The English sentence will be added later by my web app.
3. Keep the characters exactly the same in every image: same face, hair, glasses, hair clip, clothes, and colors. If I upload character reference sheets, match them closely.
4. Keep one art style in every image: a cute, cozy storybook illustration in the look of soft painted clipart, with smooth shapes, gentle shading, no harsh black outlines, and a warm pastel palette of blush pink, heart red, cream, sage green and honey brown. If I upload a style reference image, match its mood, softness and colors, but never copy its objects or layout. Not photorealistic, not 3D, not anime.
5. Leave the space the prompt asks for (usually the bottom quarter of a page, or the top quarter of a cover) calm and simple so text can go there.
6. Keep everything friendly and safe for young children.
7. After each image, write one short line with the file name I should save it as. The file name is written above each prompt, for example books/lesson2/p1.png.
8. If I say "again", make the same scene again with a different composition. If I say "fix text", remake the same image with absolutely no letters or words in it.

First, we will make the four character reference sheets. Then we will make one book at a time, in this order: cover, p1, p2, p3, p4, p5, p6, back. Reply "Ready" and wait for my first prompt.
```

## 책마다 새 대화에서 처음 쓸 문장

캐릭터 시트 이미지(와 분위기 참고 그림)를 먼저 올리고, 위 프롬프트 다음에 이 문장을 보냅니다. 숫자만 바꾸면 됩니다.

```text
Let's make the lesson 2 book. The images I uploaded are the character reference sheets (and a style reference), so keep the characters exactly like the sheets and the mood like the style reference. I'll send the prompts one by one, starting with the cover.
```

## 자주 쓰는 짧은 말

| 상황 | 보낼 말 |
| --- | --- |
| 그림에 글자가 생겼을 때 | `fix text` |
| 구도를 바꾸고 싶을 때 | `again` |
| 캐릭터 얼굴이 달라졌을 때 | `The teacher looks different from the reference sheet. Please match her face, glasses, hair clip and cardigan exactly.` |
| 아래쪽 글자 자리가 없을 때 | `Please keep the bottom quarter of the image empty and calm.` |
| 느낌이 너무 진할 때 | `Make it softer and more pastel, like the style reference.` |
