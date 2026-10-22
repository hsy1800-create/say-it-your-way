# GPT에게 보낼 프롬프트

GPT는 컴퓨터 폴더를 스스로 열 수 없어요. 대신 아래 두 파일을 채팅창에 끌어다 놓고(또는 클립 버튼으로 첨부하고) 프롬프트를 보내요.

- `GPT에_올릴_프롬프트_전체.md` (그림 61장 프롬프트가 다 들어 있는 파일)
- `style-reference.png` (분위기 참고 그림)

## 1. 처음 한 번

```text
I'm a Korean elementary school English teacher. I attached two files:
- "GPT에_올릴_프롬프트_전체.md": all the image prompts for my project, in order
- "style-reference.png": the mood I want (cute, soft, pastel storybook clipart). Match its mood and colors, but never copy its objects or layout.

Please be my illustrator and make the images in the prompt file, one at a time.

How we will work:
1. Read the whole prompt file first. The images to make are the code blocks under headings that name a file: characters/....png (4 character sheets), art/mascot.png (1 mascot), and books/lessonN/....png (7 books x 8 images). The other code blocks (Shared style, Characters) are reference only.
2. Make them in the order they appear in the file: the 4 character sheets, then the mascot, then lesson2 to lesson8 (cover, p1, p2, p3, p4, p5, p6, back).
3. For each image, use the prompt in its code block exactly as written. Do not shorten it or change the scene.
4. Make one image, then stop. Under the image, write only the file name from the heading (for example books/lesson2/p1.png) and one short line in Korean about the picture. Then wait for my reply.
5. My replies:
   - "ok" or "다음": make the next image in the order.
   - "again": make the same scene again with a different composition.
   - "fix text": remake it with no letters, words or numbers at all.
   - "얼굴": the character does not match the character sheet. Remake it, matching the sheet's face, hair, glasses, hair clip and clothes exactly.
   - If I upload an image, use it as a character reference sheet from then on.

Rules for every image:
- No text of any kind: no letters, words, numbers, signs, labels, logos, or words in speech bubbles. Screens, books and packages show only soft shapes and colors.
- The same characters every time, exactly as described in the file and as drawn in the character sheets you make first.
- The same art style every time: soft painted storybook clipart in blush pink, heart red, cream, sage green and honey brown, like style-reference.png. Not photorealistic, not 3D, not anime.
- Sizes: book pages and covers 1024 x 1536 (portrait), character sheets 1536 x 1024 (landscape), mascot 1024 x 1024 (square, transparent background if possible).
- Book pages: keep the bottom quarter calm and empty for the English sentence. Covers: keep the top quarter calm for the title.
- Friendly and safe for children aged 9 to 12.

Reply to me in Korean, briefly. If you can read both files, say "준비됐어요" and name the first image you will make. Do not make an image until I say "시작".
```

## 2. 대화가 길어져서 새 대화로 이어 갈 때

`GPT에_올릴_프롬프트_전체.md`, `style-reference.png`, 그리고 만들어 둔 캐릭터 시트 4장을 함께 올리고, 차시 숫자만 바꿔서 보내요.

```text
Same project as before. I attached the prompt file, style-reference.png, and the 4 character sheets we already made. Keep the characters exactly like the sheets and the mood like the style reference, and follow the same rules: one image at a time, no text in images, use each prompt exactly, then wait for "ok".
Let's continue with the lesson 3 book, starting from its cover (books/lesson3/cover.png). Reply to me in Korean, briefly.
```
