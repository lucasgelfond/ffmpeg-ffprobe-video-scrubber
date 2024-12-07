import { Upload, Button, message } from "antd";
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
  const ffmpeg = useRef();

  const handleExec = async () => {
    if (!file) {
      return;
    }
    setOutputImageUrl("");
    try {
      ffmpeg.current.FS("writeFile", file.name, await fetchFile(file));

      await ffmpeg.current.run(
        "-i",
        file.name,
        "-vf",
        "fps=1",
        "-vframes",
        "1",
        "frame31.jpg"
      );

      const data = ffmpeg.current.FS("readFile", "frame31.jpg");
      const type = await fileTypeFromBuffer(data.buffer);

      const objectURL = URL.createObjectURL(
        new Blob([data.buffer], { type: type.mime })
      );
      setOutputImageUrl(objectURL);
      message.success("Frame extracted successfully", 5);
    } catch (err) {
      console.error(err);
      message.error("Failed to extract frame", 5);
    }
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
        onClick={handleExec}
        disabled={!file}
        style={{ marginTop: "20px" }}
      >
        Extract Frame
      </Button>

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
