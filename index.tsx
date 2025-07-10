import React, { useState, useCallback, useMemo } from 'react';
import ReactDOM from 'react-dom/client';
import { GoogleGenAI } from "@google/genai";

const Loader = () => (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1rem', color: 'var(--text-light)' }}>
         <style>{`
            @keyframes leaf-pulse {
                0%, 100% { transform: scale(1); opacity: 0.8; }
                50% { transform: scale(1.1); opacity: 1; }
            }
        `}</style>
        <svg style={{animation: 'leaf-pulse 2s infinite ease-in-out', color: 'var(--primary-color)'}} width="48" height="48" viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg">
            <path d="M16.81,4.36C15.1,3.53,13,3.44,11.23,4.07C9.46,4.7,8,6.1,7,7.77C7,7.77,7,7.77,7,7.77C6.05,9.36,5.7,11.23,6,13.05C6.31,14.88,7.29,16.53,8.7,17.73C8.7,17.73,8.7,17.73,8.7,17.73C10.15,18.96,11.94,19.63,13.79,19.58C15.65,19.54,17.4,18.78,18.75,17.47L18.81,17.41C18.81,17.41,18.81,17.41,18.81,17.41C20.04,16.14,20.73,14.5,20.73,12.75C20.73,10.61,19.92,8.59,18.55,7.07L18.52,7.03C18.52,7.03,18.52,7.03,18.52,7.03C17.88,6.23,17.3,5.2,16.81,4.36Z" />
        </svg>
        <span>Brewing some magic...</span>
    </div>
);

// Initialize the AI client outside of the component to prevent re-creation on each render.
const ai = new GoogleGenAI({ apiKey: process.env.API_KEY as string });

const App = () => {
    const [mode, setMode] = useState<'text' | 'image'>('text');
    const [prompt, setPrompt] = useState('');
    const [imageFile, setImageFile] = useState<File | null>(null);
    const [imagePreview, setImagePreview] = useState<string | null>(null);
    const [resultImage, setResultImage] = useState<string | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const fileToBase64 = useCallback((file: File): Promise<string> => {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.readAsDataURL(file);
            reader.onload = () => resolve((reader.result as string).split(',')[1]);
            reader.onerror = (error) => reject(error);
        });
    }, []);
    
    const generateImage = useCallback(async (finalPrompt: string) => {
        const response = await ai.models.generateImages({
            model: 'imagen-3.0-generate-002',
            prompt: finalPrompt,
            config: {
              numberOfImages: 1,
              outputMimeType: 'image/jpeg',
              aspectRatio: '16:9',
            },
        });

        if (!response.generatedImages || response.generatedImages.length === 0 || !response.generatedImages[0].image?.imageBytes) {
            throw new Error("The AI couldn't create an image for that. It might be due to safety filters. Please try a different idea!");
        }

        const base64ImageBytes = response.generatedImages[0].image.imageBytes;
        setResultImage(`data:image/jpeg;base64,${base64ImageBytes}`);
    }, []);

    const handleGenerateFromText = useCallback(async () => {
        if (!prompt) {
            setError('Please describe a scene to create.');
            return;
        }
        setIsLoading(true);
        setError(null);
        setResultImage(null);

        try {
            const fullPrompt = `A beautiful cinematic scene of ${prompt}, in the iconic, hand-drawn, and detailed anime style of Studio Ghibli. Focus on whimsical details, soft natural lighting, and a painted look.`;
            await generateImage(fullPrompt);
        } catch (e) {
            setError(e instanceof Error ? e.message : 'An unknown error occurred.');
            console.error(e);
        } finally {
            setIsLoading(false);
        }
    }, [prompt, generateImage]);

    const handleTransformImage = useCallback(async () => {
        if (!imageFile) {
            setError('Please upload an image to transform.');
            return;
        }
        setIsLoading(true);
        setError(null);
        setResultImage(null);

        try {
            const base64Data = await fileToBase64(imageFile);
            const imagePart = { inlineData: { mimeType: imageFile.type, data: base64Data } };
            const textPart = { text: "Provide a highly detailed description of this image, focusing on the composition. Describe the exact placement of subjects and objects, the background, the colors, and the lighting. This will be used by an AI to recreate the scene." };
            
            const descriptionResponse = await ai.models.generateContent({
                model: 'gemini-2.5-flash',
                contents: { parts: [imagePart, textPart] },
            });
            
            const description = descriptionResponse.text;

            if (!description || !description.trim()) {
                throw new Error("The AI couldn't generate a description from your image. It might be unclear or contain content that's not allowed. Please try a different image.");
            }
            
            const fullPrompt = `A masterpiece anime illustration in the iconic style of Studio Ghibli. The scene is exactly as follows: "${description}". Faithfully recreate the composition and all details from the description, but render everything in the Ghibli art style, known for its hand-drawn look, whimsical details, and soft, natural lighting.`;
            await generateImage(fullPrompt);
        } catch (e) {
            setError(e instanceof Error ? e.message : 'An unknown error occurred during transformation.');
            console.error(e);
        } finally {
            setIsLoading(false);
        }
    }, [imageFile, fileToBase64, generateImage]);

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            setImageFile(file);
            setImagePreview(URL.createObjectURL(file));
            setError(null);
            setResultImage(null);
        }
    };
    
    const handleDownload = useCallback(() => {
        if (!resultImage) return;

        const link = document.createElement('a');
        link.href = resultImage;

        let filename = 'ghibli-dream.jpeg';
        if (mode === 'text' && prompt) {
            filename = `ghibli-dream-${prompt.replace(/[^a-zA-Z0-9]/g, '_').slice(0, 30)}.jpeg`;
        } else if (mode === 'image' && imageFile) {
            const nameWithoutExtension = imageFile.name.split('.').slice(0, -1).join('.') || imageFile.name;
            filename = `ghibli-dream-${nameWithoutExtension.replace(/[^a-zA-Z0-9]/g, '_')}.jpeg`;
        }

        link.download = filename;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    }, [resultImage, prompt, imageFile, mode]);

    const styles: { [key: string]: React.CSSProperties } = useMemo(() => ({
        container: { backgroundColor: 'var(--background-color)', padding: '2.5rem 3rem', borderRadius: '24px', boxShadow: '0 16px 40px var(--shadow-color)', border: '1.5px solid rgba(255, 255, 255, 0.9)', backdropFilter: 'blur(12px)', WebkitBackdropFilter: 'blur(12px)' },
        header: { textAlign: 'center', marginBottom: '1.5rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.75rem' },
        title: { fontSize: '3.5rem', color: 'var(--text-color)', margin: '0', fontFamily: "'Playfair Display', serif", fontWeight: 700 },
        subtitle: { fontSize: '1.2rem', color: 'var(--text-light)', marginTop: '0.5rem', marginBottom: '2.5rem', textAlign: 'center' },
        tabs: { display: 'flex', justifyContent: 'center', marginBottom: '2.5rem', gap: '1.5rem' },
        tabButton: { padding: '0.5rem 0', fontSize: '1.1rem', cursor: 'pointer', border: 'none', background: 'none', color: 'var(--text-light)', transition: 'color 0.3s', fontWeight: 600, position: 'relative' },
        activeTab: { color: 'var(--primary-color)' },
        inputSection: { display: 'flex', flexDirection: 'column', gap: '1.5rem' },
        textarea: { padding: '1rem', fontSize: '1rem', borderRadius: '12px', border: '1px solid var(--border-color)', minHeight: '100px', resize: 'vertical', backgroundColor: 'var(--secondary-color)', color: 'var(--text-color)', fontFamily: 'inherit', boxShadow: 'inset 0 2px 4px rgba(0,0,0,0.04)', transition: 'border-color 0.3s, box-shadow 0.3s' },
        fileInputLabel: { cursor: 'pointer', padding: '2rem', border: '2px dashed var(--border-color)', borderRadius: '12px', textAlign: 'center', transition: 'all 0.3s', color: 'var(--text-light)', backgroundColor: 'var(--secondary-color)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '0.75rem' },
        button: { padding: '1rem', fontSize: '1.1rem', cursor: 'pointer', border: 'none', borderRadius: '50px', backgroundColor: 'var(--primary-color)', color: 'white', fontWeight: 'bold', transition: 'all 0.3s', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '0.75rem', boxShadow: '0 4px 15px -2px rgba(74, 124, 89, 0.4)' },
        disabledButton: { backgroundColor: '#9cbba4', cursor: 'not-allowed', boxShadow: 'none' },
        resultsContainer: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(350px, 1fr))', gap: '2rem', marginTop: '3rem' },
        imageBox: { display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1rem', padding: '1rem', backgroundColor: '#fff', borderRadius: '8px', boxShadow: '0 6px 20px var(--shadow-color)', border: '1px solid #fff' },
        imageBoxTitle: { fontWeight: 600, fontSize: '1rem', color: 'var(--text-light)', margin: 0, textAlign: 'center' },
        image: { width: '100%', height: 'auto', borderRadius: '4px', objectFit: 'cover' },
        placeholder: { display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', gap: '1rem', minHeight: '250px', backgroundColor: 'transparent', color: 'var(--text-light)', borderRadius: '8px', width: '100%' },
        error: { color: 'var(--error-color)', backgroundColor: 'var(--error-bg)', padding: '1rem', borderRadius: '8px', textAlign: 'center', marginTop: '1rem', border: '1px solid var(--error-color)' },
        downloadButtonContainer: { marginTop: '1rem', width: '100%', display: 'flex', justifyContent: 'center' },
        downloadButton: { padding: '0.75rem 1.5rem', fontSize: '1rem', cursor: 'pointer', border: '1px solid var(--border-color)', borderRadius: '50px', backgroundColor: 'var(--secondary-color)', color: 'var(--primary-color)', fontWeight: 'bold', transition: 'all 0.3s', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '0.5rem' },
        footer: { textAlign: 'center', marginTop: '3rem', color: 'var(--text-light)', fontSize: '1rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem' }
    }), []);

    return (
        <div style={styles.container}>
            <style>{`
                .main-button:not(:disabled):hover { background-color: var(--primary-hover); transform: translateY(-2px); box-shadow: 0 6px 20px -2px rgba(74, 124, 89, 0.5); }
                .file-label:hover { border-color: var(--primary-color); color: var(--primary-color); background-color: #fff; }
                textarea:focus { border-color: var(--primary-color); box-shadow: 0 0 0 3px rgba(74, 124, 89, 0.1), inset 0 2px 4px rgba(0,0,0,0.04); outline: none; }
                .active-tab::after { content: '•'; color: var(--accent-color); position: absolute; bottom: -10px; left: 50%; transform: translateX(-50%); font-size: 1.5rem; }
                .download-button:hover { background-color: #f7f3e8; transform: translateY(-1px); }
            `}</style>
            <header style={styles.header}>
                <svg style={{color: 'var(--primary-color)'}} width="32" height="32" viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg">
                    <path d="M16.81,4.36C15.1,3.53,13,3.44,11.23,4.07C9.46,4.7,8,6.1,7,7.77C7,7.77,7,7.77,7,7.77C6.05,9.36,5.7,11.23,6,13.05C6.31,14.88,7.29,16.53,8.7,17.73C8.7,17.73,8.7,17.73,8.7,17.73C10.15,18.96,11.94,19.63,13.79,19.58C15.65,19.54,17.4,18.78,18.75,17.47L18.81,17.41C18.81,17.41,18.81,17.41,18.81,17.41C20.04,16.14,20.73,14.5,20.73,12.75C20.73,10.61,19.92,8.59,18.55,7.07L18.52,7.03C18.52,7.03,18.52,7.03,18.52,7.03C17.88,6.23,17.3,5.2,16.81,4.36Z" />
                </svg>
                <h1 style={styles.title}>Ghibli Dream Canvas</h1>
            </header>
            <p style={styles.subtitle}>Breathe whimsical, hand-drawn life into your ideas.</p>

            <div style={styles.tabs}>
                <button style={{...styles.tabButton, ...(mode === 'text' ? styles.activeTab : {})}} className={mode === 'text' ? 'active-tab' : ''} onClick={() => setMode('text')}>Create with Text</button>
                <button style={{...styles.tabButton, ...(mode === 'image' ? styles.activeTab : {})}} className={mode === 'image' ? 'active-tab' : ''} onClick={() => setMode('image')}>Transform an Image</button>
            </div>

            {mode === 'text' && (
                <div style={styles.inputSection}>
                    <textarea
                        style={styles.textarea}
                        placeholder="A girl sharing an umbrella with a forest spirit in the rain..."
                        value={prompt}
                        onChange={(e) => setPrompt(e.target.value)}
                        aria-label="Prompt for image generation"
                    />
                    <button className="main-button" style={{...styles.button, ...(isLoading ? styles.disabledButton : {})}} onClick={handleGenerateFromText} disabled={isLoading}>
                         {isLoading ? <span>Generating...</span> : <><svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 3c.3 0 .6.1.8.4l.8 1.2c.1.1.2.2.3.2h1.2c.5 0 1 .2 1.4.6l.8 1.2c.1.2.3.2.4.2h1.2c.6 0 1.1.5 1.1 1.1v1.2c0 .1.1.3.2.4l1.2.8c.4.4.6.9.6 1.4v1.2c0 .2.1.3.2.4l1.2.8c.4.4.6.9.6 1.4v1.2c0 .6-.5 1.1-1.1 1.1h-1.2c-.1 0-.3.1-.4.2l-.8 1.2c-.4.4-.9.6-1.4.6h-1.2c-.1 0-.2.1-.2.3l-1.2.8c-.2.2-.5.4-.8.4s-.6-.1-.8-.4l-1.2-.8c-.1-.1-.2-.2-.3-.2h-1.2c-.5 0-1-.2-1.4-.6l-.8-1.2c-.1-.2-.3-.2-.4-.2H5.1c-.6 0-1.1-.5-1.1-1.1v-1.2c0-.1-.1-.3-.2-.4l-1.2-.8c-.4-.4-.6-.9-.6-1.4v-1.2c0-.2-.1-.3-.2-.4l-1.2-.8C1.2 8.5 1 8 1 7.5v-1.2c0-.6.5-1.1 1.1-1.1h1.2c.1 0 .3-.1.4-.2l.8-1.2c.4-.4.9-.6 1.4-.6h1.2c.1 0 .2-.1.2-.3l1.2-.8c.2-.3.5-.4.8-.4z"/><path d="m12 15-3-3 3-3 3 3-3 3z"/></svg><span>Create Magic</span></>}
                    </button>
                </div>
            )}

            {mode === 'image' && (
                <div style={styles.inputSection}>
                    <label htmlFor="file-upload" className="file-label" style={styles.fileInputLabel}>
                        <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" x2="12" y1="3" y2="15"/></svg>
                        {imageFile ? `Selected: ${imageFile.name}` : 'Click to upload your image'}
                    </label>
                    <input id="file-upload" type="file" accept="image/*" onChange={handleFileChange} style={{ display: 'none' }} />
                    <button className="main-button" style={{...styles.button, ...(isLoading || !imageFile ? styles.disabledButton : {})}} onClick={handleTransformImage} disabled={isLoading || !imageFile}>
                        {isLoading ? <span>Transforming...</span> : <><svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 12a9 9 0 0 0-9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/><path d="M3 12a9 9 0 0 0 9 9 9.75 9.75 0 0 0 6.74-2.74L21 16"/><path d="M21 21v-5h-5"/></svg><span>Transform</span></>}
                    </button>
                </div>
            )}
            
            {error && <div style={styles.error} role="alert">{error}</div>}

            <div style={{...styles.resultsContainer, gridTemplateColumns: mode === 'image' && imagePreview ? '1fr 1fr' : '1fr' }}>
                {mode === 'image' && imagePreview && (
                    <div style={{...styles.imageBox, transform: 'rotate(-2deg)'}}>
                        <img src={imagePreview} alt="Uploaded preview" style={styles.image} />
                        <h3 style={styles.imageBoxTitle}>Your Original</h3>
                    </div>
                )}
                
                <div style={{...styles.imageBox, gridColumn: mode === 'image' && imagePreview ? '2' : '1', transform: resultImage ? 'rotate(2deg)' : 'none'}}>
                    {isLoading ? (
                         <Loader />
                    ) : resultImage ? (
                        <>
                            <img src={resultImage} alt="Generated Ghibli-style image" style={styles.image} />
                            <h3 style={styles.imageBoxTitle}>Your Ghibli Creation</h3>
                            <div style={styles.downloadButtonContainer}>
                                <button onClick={handleDownload} style={styles.downloadButton} className="download-button">
                                    <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" x2="12" y1="15" y2="3"/></svg>
                                    <span>Download</span>
                                </button>
                            </div>
                        </>
                    ) : (
                        <div style={styles.placeholder}>
                           <svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round"><path d="M12 22a10 10 0 0 0 10-10H2a10 10 0 0 0 10 10Z"/><path d="M2 12a10 10 0 0 1 7.2-9.7"/><path d="M14.8 2.3a10 10 0 0 1 7.2 9.7"/></svg>
                           <span>Your masterpiece will appear here</span>
                        </div>
                    )}
                </div>
            </div>
            <footer style={styles.footer}>
                <span>Created with</span>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="var(--error-color)" xmlns="http://www.w3.org/2000/svg"><path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"/></svg>
                <span>by Saqib Kamal</span>
            </footer>
        </div>
    );
};

const root = ReactDOM.createRoot(document.getElementById('root') as HTMLElement);
root.render(<App />);