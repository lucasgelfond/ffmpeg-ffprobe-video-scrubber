import { Upload, Button, message, Slider } from "antd";
import { useEffect, useRef, useState, useCallback } from "react";
import { createFFmpeg, fetchFile } from "@ffmpeg/ffmpeg";
import { InboxOutlined } from "@ant-design/icons";
import { Analytics } from "@vercel/analytics/react";
import Image from "next/image";

const { Dragger } = Upload;

const App = () => {
  const [outputImageUrl, setOutputImageUrl] = useState("");
  const [file, setFile] = useState();
  const [frameNumber, setFrameNumber] = useState(1);
  const ffmpeg = useRef();
  const fileLoaded = useRef(false);

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
          "2",
          "-vf",
          "scale=480:-1",
          "-preset",
          "ultrafast",
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

  const handleSliderChange = (value) => {
    setFrameNumber(value);
    extractFrame(value);
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

  // Reset fileLoaded when a new file is selected
  useEffect(() => {
    fileLoaded.current = false;
    if (file) {
      extractFrame(0); // Extract first frame immediately when file is loaded
    }
  }, [file, extractFrame]);

  return (
    <div className="page-app">
      <h2 align="center">FFmpeg Frame Extractor</h2>

      <h4>Upload Video</h4>
      <p style={{ color: "gray" }}>
        Your file will be processed entirely in the browser
      </p>
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
        <h4>Select Frame (1-50)</h4>
        <Slider
          min={1}
          max={50}
          value={frameNumber}
          onChange={handleSliderChange}
          disabled={!file}
        />
        <p>Current frame: {frameNumber}</p>
      </div>

      {outputImageUrl && (
        <>
          <h4>Extracted Frame</h4>
          <Image
            src={outputImageUrl}
            alt="Extracted Frame"
            width={500}
            height={300}
            style={{ maxWidth: "100%", height: "auto" }}
          />
        </>
      )}
    </div>
  );
};

export default App;
