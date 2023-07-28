import axios from 'axios';
import path from 'path';
import fs from 'fs';
import fspr from "fs/promises"
import { PythonShell } from 'python-shell';
import config from "config";
import ffmpeg from 'fluent-ffmpeg';
import ffmpegInstaller from '@ffmpeg-installer/ffmpeg';
import pkg from 'number-to-words-ru';

class Semaphore {
  constructor(count) {
    this.count = count;
    this.waiting = [];
  }

  acquire() {
    return new Promise((resolve) => {
      if (this.count > 0) {
        this.count--;
        resolve();
      } else {
        this.waiting.push(resolve);
      }
    });
  }

  release() {
    if (this.waiting.length > 0) {
      const nextInLine = this.waiting.shift();
      nextInLine();
    } else {
      this.count++;
    }
  }
}

const { convert: convertNumberToWordsRu } = pkg;
const semaphore = new Semaphore(2);
const semaphore_for_sep = new Semaphore(2);
const semaphore_for_voice = new Semaphore(2);



// Указываем путь к ffmpeg
ffmpeg.setFfmpegPath(ffmpegInstaller.path);

function transliterate(word) {
  const answer = [];
  const converter = {
    'a': 'а', 'b': 'б', 'v': 'в', 'g': 'г', 'd': 'д', 'e': 'е', 'z': 'з',
    'i': 'и', 'k': 'к', 'l': 'л', 'm': 'м', 'n': 'н', 'o': 'о', 'p': 'п',
    'r': 'р', 's': 'с', 't': 'т', 'u': 'у', 'f': 'ф', 'h': 'х', 'c': 'к'
  };

  for (let i = 0; i < word.length; i++) {
    answer.push(converter[word[i]] || word[i]);
  }

  return answer.join('');
}

function replaceLatinCharacters(text) {
  return text.replace(/[a-z]+/gi, function (word) {
    return transliterate(word.toLowerCase());
  });
}

function numbersToWords(text) {
  return text.replace(/\d+/g, function (number) {
    const options = {
      currency: 'number',
      convertNumberToWords: { integer: true, fractional: false },
      showCurrency: { integer: false, fractional: false }
    };
    return ', ' + convertNumberToWordsRu(number, options) + ',';
  });
}

function processText(text) {
  text = replaceLatinCharacters(text);
  text = numbersToWords(text);
  return text;
}

const extractAudio = (filePath, output) => {
  return new Promise((resolve, reject) => {
    ffmpeg(filePath)
      .output(output)
      .noVideo()
      .on('end', resolve)
      .on('error', reject)
      .run();
  });
};

const extractVideo = (filePath, output) => {
  return new Promise((resolve, reject) => {
    ffmpeg(filePath)
      .output(output)
      .noAudio()
      .on('end', resolve)
      .on('error', reject)
      .run();
  });
};

export const splitVideoAndAudio = async (filePath, sessionPath) => {
  const audioOutput = `${sessionPath}/audio.mp3`;
  const videoOutput = `${sessionPath}/video_empty.mp4`;

  await Promise.all([
    extractAudio(filePath, audioOutput),
    extractVideo(filePath, videoOutput),
  ]);

  // fs.unlink(filePath, (err) => {
  //   if (err) console.error(`Error deleting file: ${err}`);
  // });

  return [videoOutput, audioOutput];
};

export const mergeAudioAndVideo = (videoPath, audioPath, outputPath) => {
  return new Promise((resolve, reject) => {
    ffmpeg()
      .input(videoPath)
      .videoCodec('copy')
      .input(audioPath)
      .audioCodec('copy')
      .output(outputPath)
      .on('end', resolve)
      .on('error', reject)
      .run();
  });
};


export const mergeAudioFilesToMp3 = (vocalFile, instrumentalFile, outputFile, ctx) => {


  const vocalVolume = ctx.session.voice_volume || 1.3 // Увеличиваем громкость вокала на 20%
  const instrumentalVolume = ctx.session.instrumnet_volume || 0.7; // Уменьшаем громкость фоновой музыки на 20%

  return new Promise((resolve, reject) => {
    ffmpeg()
      .input(instrumentalFile)
      .input(vocalFile)
      .complexFilter(
        `[0:a]volume=${instrumentalVolume}[instrumental];` +
        `[1:a]volume=${vocalVolume}[vocal];` +
        `[instrumental]aformat=sample_fmts=fltp:sample_rates=44100:channel_layouts=stereo[instrumentalFormatted];` + // Добавляем фильтр aformat для фоновой музыки
        `[vocal]aformat=sample_fmts=fltp:sample_rates=44100:channel_layouts=stereo[vocalFormatted];` + // Добавляем фильтр aformat для вокала
        `[instrumentalFormatted][vocalFormatted]amerge=inputs=2[a]`,
        ['a']
      )
      .outputOption('-ac', '2') // Устанавливаем количество аудиоканалов на 2 (стерео)
      .on('error', (err) => {
        reject(err);
      })
      .on('end', () => {
        resolve();
      })
      .save(outputFile);
  });
};


async function convertWavToMp3(inputFile, outputFile) {
  return new Promise((resolve, reject) => {
    ffmpeg(inputFile)
      .output(outputFile)
      .audioCodec('libmp3lame')
      .outputOptions('-y') // Добавьте эту строку для перезаписи существующего файла
      .on('end', () => {
        console.log('Конвертация завершена');
        resolve(outputFile);
      })
      .on('error', (err) => {
        console.error('Ошибка конвертации:', err.message);
        reject(err);
      })
      .run();
  });
}

async function compressMp3(inputFile, outputFile = null, quality = 2) {
  // Если выходной файл не указан, используем "input"_cut.mp3
  if (outputFile === null) {
    const inputFileWithoutExtension = inputFile.slice(0, inputFile.lastIndexOf('.'));
    outputFile = `${inputFileWithoutExtension}_cut.mp3`;
  }

  return new Promise((resolve, reject) => {
    ffmpeg(inputFile)
      .output(outputFile)
      .audioCodec('libmp3lame')
      .audioQuality(quality)
      .outputOptions('-y')
      .on('end', () => {
        console.log('Сжатие завершено');
        resolve(outputFile);
      })
      .on('error', (err) => {
        console.error('Ошибка сжатия:', err.message);
        reject(err);
      })
      .run();
  });
}

let options;

export const getVocalFilePath = async (searchDirectory) => {
  try {
    const files = await fspr.readdir(searchDirectory);
    for (const file of files) {
      if (file.includes('(Vocals)')) {
        return path.join(searchDirectory, file);
      }
    }
    throw new Error('No file with "(Vocals)" found in the directory.');
  } catch (err) {
    throw err;
  }
};

export const getInstrumentalFilePath = async (searchDirectory, sufix = "Kim_Vocal_2") => {
  try {
    const files = await fspr.readdir(searchDirectory);
    for (const file of files) {
      if (file.includes(`(Instrumental)_${sufix}`)) {
        return path.join(searchDirectory, file);
      }
    }
    throw new Error('No file with "(Instrumental)" found in the directory.');
  } catch (err) {
    throw err;
  }
};


export const transformAudio = async (tg_options, sessionPath, audioPath = "", setMp3 = false, ctx ="") => {
  // Acquire semaphore before doing any work
  await semaphore.acquire();

  // Ensure semaphore is released, even if there is an error
  try {
    const method = tg_options.method;
    const index_ratio = tg_options.featureRatio;
    const protect_voice = tg_options.protectVoiceless;
    const pith = tg_options.pith;
    const mangio_crepe_hop = tg_options.mangioCrepeHop;

    const model_path = tg_options.model_path;
    let model_index = tg_options.model_index;

    if (model_index === undefined) {
      model_index = ""
    }

    let outOggPath = `${sessionPath}/audio_out.ogg`;

    let mp3Path = `${sessionPath}/audio_out.mp3`;

    let outpath;

    console.log(tg_options, sessionPath);

    if (audioPath === "") {
      audioPath = `${sessionPath}/audio.ogg`;
    }

    if (setMp3) {
      outpath = mp3Path;
    } else {
      outpath = outOggPath;
    }

    options = {
      mode: 'text',
      pythonPath: config.get("PYTHON_VENV_PATH"),
      pythonOptions: ['-u'], // get print results in real-time
      scriptPath: config.get("RVC_SCRIPT_PATH"),
      args: [
        pith,
        audioPath,
        model_index,
        method,
        outpath,
        model_path,
        index_ratio,
        "cuda:0",
        "True",
        "3",
        "0",
        "1",
        protect_voice,
        mangio_crepe_hop
      ]
    };

    const messages = await PythonShell.run('test-infer.py', options);
    console.log("Файл успешно преобразован");

    if (setMp3) {
      await compressMp3(mp3Path);
      console.log("Файл успешно cжат");
    }
  } catch (err) {
    console.error(err);
  } finally {
    // Always release the semaphore
    semaphore.release();
  }
};


export async function downloadFile(url, path) {
  const writer = fs.createWriteStream(path);

  const response = await axios({
    url,
    method: 'GET',
    responseType: 'stream'
  });

  response.data.pipe(writer);

  await new Promise((resolve, reject) => {
    writer.on('finish', resolve);
    writer.on('error', reject);
  });

  console.log('Файл успешно загружен');
}


export async function downloadFromYoutube(url, sessionPath) {
  let optionss = {
    mode: 'text',
    pythonPath: config.get("PYTHON_VENV_SEP_PATH"),
    pythonOptions: ['-u'], // get print results in real-time
    scriptPath: config.get("AUDIO_SEP_PATH"),
    args: [
      url,
      `${sessionPath}`,
    ]

  };
  try {
    const downloadFile = await PythonShell.run('dowload_from_youtube.py', optionss);
  } catch (err) {
    console.error(err);
  }

}

export async function separateAudio(sessionPath, filename = "audio.wav", model_name = "Kim_Vocal_2") {
  // Acquire semaphore before doing any work
  await semaphore_for_sep.acquire();

  try {
    let optionss = {
      mode: 'text',
      pythonPath: config.get("PYTHON_VENV_SEP_PATH"),
      pythonOptions: ['-u'], // get print results in real-time
      scriptPath: config.get("AUDIO_SEP_PATH"),
      args: [
        `${sessionPath}/${filename}`,
        `${sessionPath}`,
        model_name,
      ]
    };

    const messages = await PythonShell.run('script.py', optionss);

    let sessionVocalPath, sessonInstrumentalPath;

    sessionVocalPath = await getVocalFilePath(sessionPath)
    sessonInstrumentalPath = await getInstrumentalFilePath(sessionPath)

    console.log("1", sessionVocalPath, sessonInstrumentalPath, "3")

    if (model_name === "DeReverb") {
      sessonInstrumentalPath = await getInstrumentalFilePath(sessionPath, "DeReverb")
    }

    if (model_name === "DeReverb") {
      await convertWavToMp3(sessonInstrumentalPath, `${sessionPath}/vocal_de_echo.mp3`);
    } else {
      await convertWavToMp3(sessionVocalPath, `${sessionPath}/vocal.mp3`);
      await convertWavToMp3(sessonInstrumentalPath, `${sessionPath}/instrumental.mp3`);
    }

    console.log("Файл успешно преобразован")
  } catch (err) {
    console.error(err);
  } finally {
    // Always release the semaphore
    semaphore_for_sep.release();
  }
}

// Создайте экземпляр семафора


export async function createVoice(voice, text, id) {
  // Acquire semaphore before doing any work
  await semaphore_for_voice.acquire();

  const readyText = processText(text)
  console.log(readyText)
  const data = {
    speaker: voice,
    text: readyText,
    session: id
  }

  console.log(data)
  try {
    const response = await axios.post('http://127.0.0.1:8010/tts/generate', data);
    return response;
  } catch (error) {
    console.error(error);
  } finally {
    // Always release the semaphore
    semaphore_for_voice.release();
  }
}

// const data = {
//   speaker: "xenia",
//   text: "Привет красавчик люблю тебя",
//   session: "string"
// };

