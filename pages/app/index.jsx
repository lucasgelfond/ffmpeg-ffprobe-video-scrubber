import { Upload, Button, message, Slider, Input, Switch } from "antd";
import { useEffect, useRef, useState, useCallback } from "react";
import { createFFmpeg, fetchFile } from "@ffmpeg/ffmpeg";
import { InboxOutlined, LeftOutlined, RightOutlined } from "@ant-design/icons";
import Image from "next/image";
import { FFprobeWorker } from "ffprobe-wasm";

const { Dragger } = Upload;

const App = () => {
  const [outputImageUrl, setOutputImageUrl] = useState("");
  const [file, setFile] = useState();
  const [frameNumber, setFrameNumber] = useState(1);
  const [videoInfo, setVideoInfo] = useState({
    width: 0,
    height: 0,
    totalFrames: 0,
    duration: 0,
    frameRate: 0,
  });
  const [isScrubbing, setIsScrubbing] = useState(false);
  const [videoUrl, setVideoUrl] = useState("");
  const [useNativeVideo, setUseNativeVideo] = useState(true);
  const videoRef = useRef();
  const ffmpeg = useRef();
  const fileLoaded = useRef(false);
  const ffprobeWorker = useRef();

  useEffect(() => {
    ffprobeWorker.current = new FFprobeWorker();
  }, []);

  const extractFrame = useCallback(
    async (frameNum) => {
      if (!file) {
        return;
      }
      try {
        if (!fileLoaded.current) {
          ffmpeg.current.FS("writeFile", file.name, await fetchFile(file));
          fileLoaded.current = true;
        }

        await ffmpeg.current.run(
          "-ss",
          `${frameNum / 30}`,
          "-i",
          file.name,
          "-frames:v",
          "1",
          "-q:v",
          "1", // Best quality (1-31, lower is better)
          "-preset",
          "veryslow", // Highest quality preset
          "frame.jpg"
        );

        const data = ffmpeg.current.FS("readFile", "frame.jpg");
        const objectURL = URL.createObjectURL(
          new Blob([data.buffer], { type: "image/jpeg" })
        );
        setOutputImageUrl(objectURL);
      } catch (err) {
        console.error(err);
      }
    },
    [file]
  );

  useEffect(() => {}, [videoInfo]);

  const handleSliderChange = async (value) => {
    setFrameNumber(value);
    if (useNativeVideo) {
      setIsScrubbing(true);
      if (videoRef.current) {
        videoRef.current.currentTime = value / videoInfo.frameRate;
      }
    } else {
      await extractFrame(value);
    }
  };

  const handleSliderAfterChange = async (value) => {
    if (useNativeVideo) {
      setIsScrubbing(false);
      setOutputImageUrl(""); // Clear the image while extracting new frame
      await extractFrame(value);
    }
  };

  const handleInputChange = async (e) => {
    const value = parseInt(e.target.value);
    if (!isNaN(value) && value >= 1 && value <= videoInfo.totalFrames) {
      setFrameNumber(value);
      if (useNativeVideo && videoRef.current) {
        videoRef.current.currentTime = value / videoInfo.frameRate;
      }
      await extractFrame(value);
    }
  };

  const handleFrameStep = async (step) => {
    const newFrame = Math.min(
      Math.max(1, frameNumber + step),
      videoInfo.totalFrames
    );
    setFrameNumber(newFrame);
    await extractFrame(newFrame);
  };

  useEffect(() => {
    (async () => {
      ffmpeg.current = createFFmpeg({
        log: true,
        corePath:
          "https://cdn.jsdelivr.net/npm/@ffmpeg/core@0.11.0/dist/ffmpeg-core.js",
      });
      await ffmpeg.current.load();
    })();
  }, []);

  const getVideoInfo = useCallback(async () => {
    const fileInfo = await ffprobeWorker.current.getFileInfo(file);

    // Find video stream
    const videoStream = fileInfo.streams.find((s) => s.codec_type === "video");

    setVideoInfo({
      width: videoStream.codec_width,
      height: videoStream.codec_height,
      totalFrames: parseInt(videoStream.nb_frames),
      duration: parseFloat(fileInfo.format.duration),
      frameRate: eval(videoStream.r_frame_rate), // Evaluates "30/1" to 30
    });
  }, [file]);

  // Reset fileLoaded and create video URL when a new file is selected
  useEffect(() => {
    fileLoaded.current = false;
    if (file) {
      const url = URL.createObjectURL(file);
      setVideoUrl(url);
      getVideoInfo();
      extractFrame(0); // Extract first frame immediately when file is loaded
      return () => URL.revokeObjectURL(url);
    }
  }, [file, extractFrame, getVideoInfo]);

  const displayWidth = Math.round(videoInfo.width / 4);
  const displayHeight = Math.round(videoInfo.height / 4);

  return (
    <div className="page-app">
      <h2 align="center">FFmpeg Frame Scrubber</h2>

      <div style={{ marginBottom: "20px" }}>
        <Switch
          checked={useNativeVideo}
          onChange={setUseNativeVideo}
          checkedChildren="Using native video in scrubbing"
          unCheckedChildren="Using frame extraction in scrubbing"
        />
      </div>

      <h4>Upload Video</h4>
      <Dragger
        beforeUpload={(file) => {
          setFile(file);
          return false;
        }}
      >
        <p className="ant-upload-drag-icon">
          <InboxOutlined />
        </p>
        <p className="ant-upload-text">Click or drag video file</p>
      </Dragger>

      <Button
        type="primary"
        onClick={() => extractFrame(frameNumber)}
        disabled={!file}
        style={{ marginTop: "20px" }}
      >
        Extract Frame
      </Button>

      <div style={{ marginTop: "20px" }}>
        <h4>Select Frame (1-{videoInfo.totalFrames})</h4>
        <Slider
          min={1}
          max={videoInfo.totalFrames}
          value={frameNumber}
          onChange={handleSliderChange}
          onAfterChange={handleSliderAfterChange}
          disabled={!file}
        />
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "10px",
            marginTop: "10px",
          }}
        >
          <Button
            icon={<LeftOutlined />}
            onClick={() => handleFrameStep(-1)}
            disabled={!file || frameNumber <= 1}
          />
          <Input
            type="number"
            value={frameNumber}
            onChange={handleInputChange}
            disabled={!file}
            style={{ width: "100px" }}
          />
          <Button
            icon={<RightOutlined />}
            onClick={() => handleFrameStep(1)}
            disabled={!file || frameNumber >= videoInfo.totalFrames}
          />
        </div>
      </div>

      {file && (
        <div style={{ marginTop: "20px" }}>
          <h4>Preview</h4>
          {useNativeVideo && (isScrubbing || !outputImageUrl) ? (
            <video
              ref={videoRef}
              src={videoUrl}
              width={displayWidth}
              height={displayHeight}
              style={{ maxWidth: "100%", height: "auto" }}
            />
          ) : outputImageUrl ? (
            <Image
              src={outputImageUrl}
              alt="Extracted Frame"
              width={displayWidth}
              height={displayHeight}
              style={{ maxWidth: "100%", height: "auto" }}
            />
          ) : null}
        </div>
      )}
    </div>
  );
};

export default App;
