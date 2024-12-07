import { Upload, Button, message, Slider } from "antd";
import { useEffect, useRef, useState } from "react";
import { createFFmpeg, fetchFile } from "@ffmpeg/ffmpeg";
import { InboxOutlined } from "@ant-design/icons";
import { fileTypeFromBuffer } from "file-type";
import { Analytics } from "@vercel/analytics/react";
import Image from "next/image";

const { Dragger } = Upload;

const App = () => {
  const [outputImageUrl, setOutputImageUrl] = useState("");
  const [file, setFile] = useState();
  const [frameNumber, setFrameNumber] = useState(1);
  const ffmpeg = useRef();

  const extractFrame = async (frameNum) => {
    if (!file) {
      return;
    }
    try {
      ffmpeg.current.FS("writeFile", file.name, await fetchFile(file));
      await ffmpeg.current.run(
        "-ss",
        `${frameNum / 30}`, // Assuming 30fps - converts frame number to seconds
        "-i",
        file.name,
        "-frames:v",
        "1",
        "-q:v",
        "5", // Medium compression quality - range is 2-31
        "-vf",
        "scale=320:-1", // Increased resolution to 480px width
        "-preset",
        "ultrafast", // Fastest encoding preset
        "frame.jpg"
      );

      const data = ffmpeg.current.FS("readFile", "frame.jpg");
      const type = await fileTypeFromBuffer(data.buffer);

      const objectURL = URL.createObjectURL(
        new Blob([data.buffer], { type: type.mime })
      );
      setOutputImageUrl(objectURL);
    } catch (err) {
      console.error(err);
    }
  };

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
