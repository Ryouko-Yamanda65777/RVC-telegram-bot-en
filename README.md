# RVC TELEGRAM BOT

This Telegram bot can process any audio file, voice message, or video and transform the voice using RVC technology.

You can check out a demonstration of the bot's capabilities [here](https://t.me/mister_parodist_rvc_bot).

## Voice Pack
I recently released a voice pack (250 voices), which I compiled over about 2.5 months. It mostly contains Russian voices, but there are some English and Japanese ones as well. [Click here](https://huggingface.co/daswer123/RVC-big-ru-voice-pack/tree/main).

## Key Features
- Fast voice conversion
- Ability to automatically create AI covers, just by sending a song or a YouTube link
- Text-to-speech using any character's voice (Yandex + Silero)
- Fine-tuning of voice and AI cover creation
- A large number of effects for pre- and post-processing (echo, reverb, autotune, compression)
- Ability to split a song into vocals and instrumental, or remove specific instruments
- A menu to collect user data for training custom models
- Save and load presets
- Users can submit suggestions for improvements via a dedicated button
- New transformation methods: Mangio-crepe, rmvpe, and rmvpe+
- Load control and queue management features

## DEMO (Turn Sound on)

https://github.com/daswer123/RVC-telegram-bot/assets/22278673/ce3895d2-3208-470c-85f8-f59496cd8185

## TODO
- [x] Split the code into modules
- [x] Separate server and bot parts
- [x] Add queue system
- [x] Add subscription system
- [ ] Refactor code (partially done)
- [x] Improve UI

## Installation Guide:
1) Make sure you have the following installed: [Python 3.10.x](https://www.python.org/downloads/release/python-3109/), [Node JS 18+](https://nodejs.org/dist/v18.16.1/node-v18.16.1-x64.msi), [Microsoft Build Tools 2019](https://visualstudio.microsoft.com/visual-cpp-build-tools/), [ffmpeg](https://ffmpeg.org/), [CUDA 11.7](https://developer.download.nvidia.com/compute/cuda/11.7.0/local_installers/cuda_11.7.0_516.01_windows.exe) or [CUDA 11.8](https://developer.download.nvidia.com/compute/cuda/11.8.0/local_installers/cuda_11.8.0_522.06_windows.exe)
2) Create a bot in BotFather
3) Clone this repository
4) Run `install.bat` in the root folder
5) Skip this step if you're not using Portable. Run `update_path.bat` in the root folder
6) After the download completes, go to the utils folder and run `create main config.bat`; you will need to provide your bot token
6) Next, set up the structure for your voice models by going to the MODELS folder and reading the [Readme](https://github.com/daswer123/tg_rvc_bot/tree/main/MODELS#readme), which outlines the folder structure required

![image](https://github.com/daswer123/tg_rvc_bot/assets/22278673/713ed830-cf18-4e3f-a4bf-6812b7d3dcdd)

7) Once the voice model structure is ready, run the `create characters config.bat` script in the `utils` folder
8) You're all set! Now, run `start.bat` and start using the bot

# Bot Usage Notes
1) Whenever you add a new character, don’t forget to run `create characters config.bat` in the `utils` folder again
2) You can adjust the number of concurrent requests your computer processes, as well as the maximum number of requests in the queue per user. Look for settings in `server.js` and `variables.js`
3) All user messages are saved in the sessions folder
4) The bot uses Mangio-RVC-Fork
5) The bot has been tested on Windows 10, RTX 3090, CUDA 11.8

# Credits

1) [Mangio-RVC-Fork](https://github.com/Mangio621/Mangio-RVC-Fork) – A modified version of RVC with new transformation methods
2) [python-audio-separator](https://github.com/karaokenerds/python-audio-separator) – Audio separation into vocals and instrumentals using the MDX architecture
3) [Silero TTS](https://github.com/snakers4/silero-models) – Russian-language TTS
4) [doremi](https://github.com/jpmchargue/doremi) – Autotune library
5) [pedalboard](https://github.com/spotify/pedalboard) – Effects library
6) [Demucs](https://github.com/facebookresearch/demucs) – Audio separation into vocals and instrumentals
