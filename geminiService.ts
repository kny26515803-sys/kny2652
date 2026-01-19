
import { GoogleGenAI, Type } from "@google/genai";
import { ScriptLength, ResearchData, ScriptData, MetadataResults, ThumbnailData, ParagraphItem } from "./types";

const getAI = () => new GoogleGenAI({ apiKey: process.env.API_KEY || '' });

export const performResearch = async (topic: string): Promise<ResearchData> => {
  const ai = getAI();
  const response = await ai.models.generateContent({
    model: 'gemini-3-pro-preview',
    contents: `주제: ${topic}. 이 주제에 대해 최신 정보를 바탕으로 팩트 체크를 포함한 상세한 보고서를 작성해줘. 한국어로 작성하며, 허위 내용 없이 사실 위주로 구성해.`,
    config: {
      tools: [{ googleSearch: {} }]
    }
  });

  const sources = response.candidates?.[0]?.groundingMetadata?.groundingChunks?.map((chunk: any) => ({
    title: chunk.web?.title || '출처',
    uri: chunk.web?.uri || '#'
  })) || [];

  return {
    report: response.text || '',
    sources
  };
};

export const generateScript = async (research: string, length: ScriptLength): Promise<ScriptData> => {
  const ai = getAI();
  const targetChars = length === ScriptLength.SHORT ? 4000 : length === ScriptLength.MEDIUM ? 8000 : 12000;
  
  const prompt = `
    다음 조사 보고서를 바탕으로 유튜브 내레이션 대본을 작성해줘.
    조사 보고서: ${research}
    
    [작성 가이드라인]
    1. 분량: 공백 포함 약 ${targetChars}자 내외 (매우 중요, 풍부하게 작성할 것)
    2. 시점: 1인칭 시점, 자연스러운 혼잣말 내레이션 형식
    3. 구조: 도입부(30초 후킹)-전개-위기-전환-결말
    4. 특징: 구체적인 사례 포함, 시청자의 상상력을 자극하는 묘사, 자연스러운 CTA 포함
    5. 스타일: 팩트 기반이지만 공감을 이끌어내는 스토리텔링
    
    [출력 형식]
    - 전체 대본을 작성한 뒤, 이를 정확히 12개의 의미 있는 문단으로 나누어줘.
    - 각 문단별로 Vrew TTS 프로그램에 최적화된 구어체(##, ** 같은 특수문자 절대 제외)로 변환한 내레이션 텍스트도 함께 생성해줘.
    - 각 문단에 어울리는 '실사/초현실적 한국 배경/한국인' 이미지 생성 프롬프트(영문)도 작성해줘.
  `;

  const response = await ai.models.generateContent({
    model: 'gemini-3-pro-preview',
    contents: prompt,
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          rawScript: { type: Type.STRING },
          ttsScript: { type: Type.STRING },
          paragraphs: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                id: { type: Type.INTEGER },
                content: { type: Type.STRING },
                imagePrompt: { type: Type.STRING }
              },
              required: ["id", "content", "imagePrompt"]
            }
          }
        },
        required: ["rawScript", "ttsScript", "paragraphs"]
      }
    }
  });

  const data = JSON.parse(response.text || '{}');
  return data;
};

export const generateImage = async (prompt: string): Promise<string> => {
  const ai = getAI();
  const enhancedPrompt = `Photorealistic, surreal high-quality image, set in Korea with Korean people, high resolution, cinematic lighting, no text: ${prompt}`;
  
  const response = await ai.models.generateContent({
    model: 'gemini-2.5-flash-image',
    contents: { parts: [{ text: enhancedPrompt }] },
    config: {
      imageConfig: { aspectRatio: "16:9" }
    }
  });

  let imageUrl = '';
  for (const part of response.candidates?.[0]?.content?.parts || []) {
    if (part.inlineData) {
      imageUrl = `data:image/png;base64,${part.inlineData.data}`;
      break;
    }
  }
  return imageUrl;
};

export const generateMetadata = async (script: string): Promise<MetadataResults> => {
  const ai = getAI();
  const response = await ai.models.generateContent({
    model: 'gemini-3-flash-preview',
    contents: `다음 대본을 분석하여 유튜브 메타데이터를 작성해줘. 
    대본: ${script.substring(0, 5000)}
    
    요구사항:
    1. 유튜브 설명란용 전체 요약
    2. 핵심 요약 4줄
    3. 대표 해시태그 7개 (한 줄에 표시)
    4. SEO 키워드 20개 (쉼표로 구분)
    5. 영상 고정 댓글용 인사말 및 설명`,
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          youtubeDescription: { type: Type.STRING },
          summary4Lines: { type: Type.STRING },
          hashtags: { type: Type.ARRAY, items: { type: Type.STRING } },
          seoKeywords: { type: Type.ARRAY, items: { type: Type.STRING } },
          pinnedComment: { type: Type.STRING }
        }
      }
    }
  });

  return JSON.parse(response.text || '{}');
};

export const generateThumbnailContent = async (script: string): Promise<ThumbnailData> => {
  const ai = getAI();
  
  // 1. Text content generation
  const textResponse = await ai.models.generateContent({
    model: 'gemini-3-flash-preview',
    contents: `다음 대본에 어울리는 유튜브 썸네일 문구를 생성해줘.
    대본: ${script.substring(0, 2000)}
    
    [형태1: 주제, 궁금증/후킹, 가치] 3가지
    [형태2: 주제, 후킹, 가치] 3가지
    각각의 썸네일 이미지를 위한 묘사 프롬프트(영문)도 하나 추천해줘.`,
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          copySuggestions: {
            type: Type.OBJECT,
            properties: {
              type1: { type: Type.ARRAY, items: { type: Type.STRING } },
              type2: { type: Type.ARRAY, items: { type: Type.STRING } }
            }
          },
          imagePrompt: { type: Type.STRING }
        }
      }
    }
  });

  const textData = JSON.parse(textResponse.text || '{}');
  
  // 2. Generate pure image for thumbnail
  const pureImage = await generateImage(`Hyper-realistic cinematic YouTube thumbnail background, Korean context, emotionally grabbing, no text: ${textData.imagePrompt}`);

  return {
    pureImageUrl: pureImage,
    copySuggestions: textData.copySuggestions
  };
};
