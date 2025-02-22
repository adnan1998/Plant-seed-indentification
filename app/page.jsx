"use client";
import React, { useState, useRef, useEffect } from "react";
import { GoogleGenerativeAI } from "@google/generative-ai";
import Head from "next/head";
import Skeleton from "@mui/material/Skeleton"; // MUI Skeleton

// const geminiApiKey = process.env.NEXT_PUBLIC_API_KEY; 
const geminiApiKey = process.env.PLANT_API_KEY; // Replace with your actual API key

const Home = () => {
  const [deferredPrompt, setDeferredPrompt] = useState(null);
  const [showInstallButton, setShowInstallButton] = useState(false);
  
  const [image, setImage] = useState(null);
  const [plantName, setPlantName] = useState("");
  const [plantInfo, setPlantInfo] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const [streaming, setStreaming] = useState(false);
  const [cameraActive, setCameraActive] = useState(false);
  const [currentFacingMode, setCurrentFacingMode] = useState("environment");
  
  const handleImageUpload = (event) => {
    const file = event.target.files[0];
    setImage(file);
  };
  
  useEffect(() => {
    if (typeof window !== "undefined") {
      const element = document.querySelector(".animated-background");
      if (element) {
        element.style.position = "absolute";
        element.style.top = "0";
        element.style.left = "0";
        element.style.width = "100%";
        element.style.height = "100%";
        element.style.zIndex = "-1";
      }
    }
  }, []);
  
  useEffect(() => {
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker
        .register("/sw.js")
        .then((registration) => {
          console.log("Service Worker registration succeeded:", registration);
        })
        .catch((error) => {
          console.error("Service Worker registration failed:", error);
        });
    }
  }, []);
  
  useEffect(() => {
    const handler = (e) => {
      console.log("beforeinstallprompt event fired", e);
      e.preventDefault();
      setDeferredPrompt(e);
      setShowInstallButton(true);
    };
  
    window.addEventListener("beforeinstallprompt", handler);
    return () => window.removeEventListener("beforeinstallprompt", handler);
  }, []);
  
  const handleInstallClick = async () => {
    if (!deferredPrompt) return;
    console.log("Install button clicked");
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    console.log("User choice:", outcome);
    setDeferredPrompt(null);
    setShowInstallButton(false);
  };
  
  const accessCamera = async () => {
    if (cameraActive) {
      if (videoRef.current && videoRef.current.srcObject) {
        const stream = videoRef.current.srcObject;
        const tracks = stream.getTracks();
        tracks.forEach((track) => track.stop());
        videoRef.current.srcObject = null;
      }
      setStreaming(false);
      setCameraActive(false);
    } else {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { exact: currentFacingMode } },
        });
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          setStreaming(true);
          setCameraActive(true);
        }
      } catch (err) {
        console.error("Error accessing camera:", err);
        setError("Error accessing camera. Please check your permissions.");
        setCameraActive(false);
      }
    }
  };
  
  const switchCamera = async () => {
    const newFacingMode = currentFacingMode === "environment" ? "user" : "environment";
  
    try {
      if (videoRef.current && videoRef.current.srcObject) {
        const stream = videoRef.current.srcObject;
        const tracks = stream.getTracks();
        tracks.forEach(track => track.stop());
        videoRef.current.srcObject = null; // Important: Clear the srcObject
  
        // Small delay before getting the new stream (adjust as needed)
        setTimeout(async () => {
          try {
            const newStream = await navigator.mediaDevices.getUserMedia({
              video: { facingMode: { exact: newFacingMode } },
            });
            setCurrentFacingMode(newFacingMode);
            if (videoRef.current) {
              videoRef.current.srcObject = newStream;
            }
          } catch (newStreamErr) {
            console.error("Error getting new stream:", newStreamErr);
            setError("Error switching camera (new stream): " + newStreamErr.message);
          }
        }, 100); // 100ms delay
  
      } else {
          const newStream = await navigator.mediaDevices.getUserMedia({
            video: { facingMode: { exact: newFacingMode } },
          });
          setCurrentFacingMode(newFacingMode);
          if (videoRef.current) {
            videoRef.current.srcObject = newStream;
          }
      }
  
    } catch (err) {
      console.error("Error switching camera:", err);
      setError("Error switching camera: " + err.message);
    }
  };
  
  const takePicture = () => {
    if (!streaming || !videoRef.current || !canvasRef.current) {
      setError("Camera not ready.");
      return;
    }
    const video = videoRef.current;
    const canvas = canvasRef.current;
    const context = canvas.getContext("2d");
  
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    context.drawImage(video, 0, 0, video.videoWidth, video.videoHeight);
  
    const dataURL = canvas.toDataURL("image/jpeg");
    setImage(dataURL);
  
    if (videoRef.current && videoRef.current.srcObject) {
      const stream = videoRef.current.srcObject;
      const tracks = stream.getTracks();
      tracks.forEach((track) => track.stop());
      videoRef.current.srcObject = null;
    }
    setStreaming(false);
    setCameraActive(false);
  };
  
  const identifyPlant = async () => {
    if (!image) {
      setError("Please upload or capture an image first.");
      return;
    }
    setLoading(true);
    setError("");
    setPlantName("");
    setPlantInfo("");
  
    const processImage = async (imageDataUrl) => {
      const prompt = `What is the common name of this plant/tree/seed? Also, provide the scientific name and 3-4 brief points about caring for it. If the plant/tree/seed has multiple common names, prioritize the most widely used one. Keep the information concise and to the point.  Format the response as follows:
      
  Common Name: [Common Plant/tree/seed Name], [Common Plant/tree/seed Name in hindi if available]
  Scientific Name: [Scientific Plant/tree/seed Name]
  Care Information:
  - [Point 1]
  - [Point 2]
  - [Point 3]`;

  // const prompt = `Analyze this skin condition and provide:
  // 1. Common name (non-technical)
  // 2. Medical term
  // 3. Severity (mild/moderate/severe)
  // 4. 3-4 immediate care steps
  // 5. Consultation advice for medical attention`;
  
      const imageParts = [
        {
          inlineData: {
            data: imageDataUrl.split(",")[1],
            mimeType: typeof image === "string" ? "image/jpeg" : image.type,
          },
        },
      ];
  
      try {
        const genAI = new GoogleGenerativeAI(geminiApiKey);
        const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });
        const result = await model.generateContent([prompt, imageParts]);
        const responseText = result.response.text();
  
        try {
          const commonNameMatch = responseText.match(/Common Name: (.*)/);
          const scientificNameMatch = responseText.match(/Scientific Name: (.*)/);
          const careInfoMatch = responseText.match(/Care Information:(.*)/s);
  
          const commonName = commonNameMatch ? commonNameMatch[1].trim() : "Unknown Common Name";
          const scientificName = scientificNameMatch ? scientificNameMatch[1].trim() : "Unknown Scientific Name";
          const careInfo = careInfoMatch ? careInfoMatch[1].trim() : "No care information available.";
  
          setPlantName(commonName);
          setPlantInfo({ scientificName, careInfo });
        } catch (parseError) {
          console.error("Error parsing Gemini response:", parseError);
          setError("Could not parse the information from the response. Please try again.");
          setPlantName("");
          setPlantInfo("");
        }
      } catch (err) {
        console.error("Error during Gemini content generation:", err);
        setError(`Error identifying plant: ${err.message}`);
      } finally {
        setLoading(false);
      }
    };
  
    try {
      let imageDataUrl = image;
      if (typeof image !== "string") {
        const reader = new FileReader();
        reader.onload = (event) => {
          imageDataUrl = event.target.result;
          processImage(imageDataUrl);
        };
        reader.onerror = () => {
          setError("Error reading the image file.");
          setLoading(false);
        };
        reader.readAsDataURL(image);
      } else {
        processImage(imageDataUrl);
      }
    } catch (err) {
      console.error("Error during plant identification:", err);
      setError(`Error identifying plant: ${err.message}`);
    } finally {
      if (loading) {
        setLoading(false);
      }
    }
  };
  

  return (
    <>
      <Head>
        <title>Plant Identifier - Identify Plants with AI</title>
        <link rel="manifest" href="/manifest.json" />
        <link rel="apple-touch-icon" href="/icons/apple-touch-icon.png" />
        <link rel="icon" href="/favicon.ico" />
        <meta
          name="description"
          content="Identify plants instantly using AI! Upload an image or take a photo and get the plant's name and care tips."
        />
        <link rel="canonical" href="https://plantid.anuragshaw.in/" />
        <meta
          name="keywords"
          content="plant identification, ai plant identifier, plant care, identify plants, plant name, plant species, gardening, horticulture"
        />
        <meta name="robots" content="index, follow" />
        <meta
          property="og:title"
          content="Plant Identifier - Identify Plants with AI"
        />
        <meta
          property="og:description"
          content="Identify plants instantly using AI! Upload an image or take a photo and get the plant's name and care tips."
        />
        <meta
          property="og:image"
          content="https://plantid.anuragshaw.in/plant.png"
        />
        <meta
          property="og:url"
          content="https://plantid.anuragshaw.in/"
        />
        <meta property="og:type" content="website" />
        <meta name="twitter:card" content="summary_large_image" />
        <meta
          name="twitter:title"
          content="Plant Identifier - Identify Plants with AI"
        />
        <meta
          name="twitter:description"
          content="Identify plants instantly using AI! Upload an image or take a photo and get the plant's name and care tips."
        />
        <meta
          property="twitter:image"
          content="https://plantid.anuragshaw.in/plant.png"
        />
      </Head>

      <div className="relative flex flex-col items-center justify-start min-h-screen text-white font-sans p-4 md:p-8">
        <div className="animated-background"></div>
        <h1 className="text-3xl md:text-4xl lg:text-5xl font-bold mb-6 text-center">
          Plant Identifier by Adnan
        </h1>

        {error && (
          <div className="bg-red-700 text-white p-2 rounded mb-4">{error}</div>
        )}

        {/* PWA Install Button */}
        {showInstallButton && (
          <button
            onClick={handleInstallClick}
            className="mb-4 bg-blue-600 text-white py-2 px-4 rounded"
          >
            Install App
          </button>
        )}

        {/* File Upload */}
        <div className="mb-4 w-full max-w-md">
          <label
            htmlFor="file-upload"
            className="block w-full text-center bg-[#00A9A5] text-[#092327] py-2 px-4 rounded cursor-pointer transition-colors duration-300 hover:bg-[#0B5351] hover:text-white"
          >
            Choose Image
          </label>
          <input
            id="file-upload"
            type="file"
            accept="image/*"
            onChange={handleImageUpload}
            disabled={loading || cameraActive}
            className="hidden"
          />
        </div>

        {/* Camera Access */}
        <div className="flex w-full justify-center gap-2 items-center md:space-x-4 mb-4">
          <button
            onClick={accessCamera}
            disabled={loading}
            className="flex-grow md:flex-none w-full md:w-auto bg-[#00A9A5] text-[#092327] py-2 px-4 rounded transition-colors duration-300 hover:bg-[#0B5351] hover:text-white disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {cameraActive ? "Close Camera" : "Open Camera"}
          </button>
          
          {cameraActive && typeof window !== 'undefined' && window.innerWidth <= 768 && (
            <button
              onClick={switchCamera}
              disabled={loading}
              className="flex-grow md:flex-none w-full md:w-auto bg-[#00A9A5] text-[#092327] py-2 px-4 rounded transition-colors duration-300 hover:bg-[#0B5351] hover:text-white disabled:opacity-50 disabled:cursor-not-allowed md:mt-0"
            >
              Switch Camera
            </button>
          )}

        </div>

        <div className="relative w-full max-w-md">
          <video
            ref={videoRef}
            autoPlay
            className={`w-full rounded-md shadow-lg ${
              cameraActive ? "block" : "hidden"
            }`}
          />
          {cameraActive && streaming && (
            <button
              onClick={takePicture}
              disabled={loading}
              className="absolute bottom-2 left-1/2 transform -translate-x-1/2 bg-[#00A9A5] text-[#092327] py-2 px-4 rounded transition-colors duration-300 hover:bg-[#0B5351] hover:text-white"
            >
              Take Picture
            </button>
          )}
          <canvas ref={canvasRef} style={{ display: "none" }} />
        </div>

        {image && (
          <img
            src={typeof image === "string" ? image : URL.createObjectURL(image)}
            alt="Uploaded Plant"
            className="w-full max-w-md mt-4 rounded-md shadow-lg"
          />
        )}

        <button
          onClick={identifyPlant}
          disabled={loading || !image}
          className="w-full max-w-md mt-6 bg-[#00A9A5] text-[#092327] py-3 px-6 rounded text-lg transition-colors duration-300 hover:bg-[#0B5351] hover:text-white disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {loading ? "Identifying..." : "Identify Plant"}
        </button>

        {(plantName || loading) && (
          <div className="w-full max-w-md mt-8 p-4 rounded-md shadow-md bg-[#0B5351]">
            {loading ? (
              <>
                <Skeleton variant="text" height={40} className="mb-2" />
                <Skeleton variant="text" height={20} width="80%" />
                <Skeleton variant="text" height={20} width="60%" />
                <Skeleton variant="text" height={20} width="40%" />
              </>
            ) : (
              <>
                <h2 className="text-xl font-semibold mb-2">
                  Plant Name: {plantName}
                </h2>
                <p className="font-italic mb-2">
                  Scientific Name: {plantInfo?.scientificName}
                </p>
                <div className="mt-2">
                  <h3 className="font-semibold">Care Information:</h3>
                  <ul className="list-disc list-inside ml-5">
                    {plantInfo?.careInfo
                      .split("-")
                      .filter(Boolean)
                      .map((point, index) => (
                        <li key={index} className="mb-1 leading-relaxed">
                          {point.trim()}
                        </li>
                      ))}
                  </ul>
                </div>
              </>
            )}
          </div>
        )}

        <footer className="mt-8 text-gray-400">
          © 2024 Plant Identifier App
        </footer>
      </div>
    </>
  );
};

export default Home;


// t also a chatbot section where user can ask further question about that plant generate an ui design for this

// i have a ai agent named Plant Identification. which have upload image button, open camera button, image section and plant heading section and its point also a chatbot section where user can ask further question about that plant generate an ui design for this