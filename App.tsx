
import React, { useState, useCallback, useEffect } from 'react';
import { 
  AppStep, 
  AppState, 
  ScriptLength, 
  ResearchData, 
  ScriptData, 
  MetadataResults, 
  ThumbnailData 
} from './types';
import { 
  performResearch, 
  generateScript, 
  generateImage, 
  generateMetadata, 
  generateThumbnailContent 
} from './geminiService';
import { 
  Search, 
  FileText, 
  Image as ImageIcon, 
  Hash, 
  Layout, 
  PlayCircle, 
  Loader2, 
  Download, 
  RefreshCw,
  ChevronRight,
  ChevronLeft
} from 'lucide-react';

export default function App() {
  const [state, setState] = useState<AppState>({
    currentStep: AppStep.INPUT,
    topic: '',
    length: ScriptLength.MEDIUM,
    isProcessing: false
  });

  const updateState = (updates: Partial<AppState>) => {
    setState(prev => ({ ...prev, ...updates }));
  };

  const startWorkflow = async () => {
    if (!state.topic) return;
    updateState({ isProcessing: true, currentStep: AppStep.RESEARCH });

    try {
      // 1. Research
      const research = await performResearch(state.topic);
      updateState({ research });

      // 2. Script
      updateState({ currentStep: AppStep.SCRIPT });
      const scriptData = await generateScript(research.report, state.length);
      updateState({ script: scriptData });

      // 3. Metadata
      updateState({ currentStep: AppStep.METADATA });
      const metadata = await generateMetadata(scriptData.ttsScript);
      updateState({ metadata });

      // 4. Thumbnail
      updateState({ currentStep: AppStep.THUMBNAIL });
      const thumbnail = await generateThumbnailContent(scriptData.ttsScript);
      updateState({ thumbnail });

      // 5. Auto Image generation for paragraphs
      updateState({ currentStep: AppStep.IMAGES });
      const updatedParagraphs = [...scriptData.paragraphs];
      for (let i = 0; i < updatedParagraphs.length; i++) {
        updatedParagraphs[i].isGenerating = true;
        updateState({ script: { ...scriptData, paragraphs: [...updatedParagraphs] } });
        
        try {
          const url = await generateImage(updatedParagraphs[i].imagePrompt);
          updatedParagraphs[i].imageUrl = url;
        } catch (err) {
          console.error(`Failed to generate image for paragraph ${i}`, err);
        }
        
        updatedParagraphs[i].isGenerating = false;
        updateState({ script: { ...scriptData, paragraphs: [...updatedParagraphs] } });
      }

    } catch (error) {
      console.error("Workflow failed", error);
      alert("처리 중 오류가 발생했습니다. 다시 시도해 주세요.");
    } finally {
      updateState({ isProcessing: false });
    }
  };

  const handleTopicSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    startWorkflow();
  };

  const downloadImage = (url: string, filename: string) => {
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const downloadAllImages = () => {
    state.script?.paragraphs.forEach((p, idx) => {
      if (p.imageUrl) downloadImage(p.imageUrl, `scene_${idx + 1}.png`);
    });
  };

  const retryImage = async (index: number) => {
    if (!state.script) return;
    const newParagraphs = [...state.script.paragraphs];
    newParagraphs[index].isGenerating = true;
    updateState({ script: { ...state.script, paragraphs: newParagraphs } });

    try {
      const url = await generateImage(newParagraphs[index].imagePrompt);
      newParagraphs[index].imageUrl = url;
    } catch (err) {
      console.error(err);
    }

    newParagraphs[index].isGenerating = false;
    updateState({ script: { ...state.script, paragraphs: newParagraphs } });
  };

  const renderStepNav = () => (
    <div className="flex overflow-x-auto gap-4 mb-8 pb-2 border-b border-slate-700 no-scrollbar">
      {[
        { id: AppStep.INPUT, label: '입력', icon: Search },
        { id: AppStep.RESEARCH, label: '조사보고서', icon: FileText },
        { id: AppStep.SCRIPT, label: '대본/TTS', icon: PlayCircle },
        { id: AppStep.IMAGES, label: '이미지 구성', icon: ImageIcon },
        { id: AppStep.METADATA, label: '메타데이터', icon: Hash },
        { id: AppStep.THUMBNAIL, label: '썸네일', icon: Layout },
      ].map(step => (
        <button
          key={step.id}
          onClick={() => updateState({ currentStep: step.id })}
          disabled={state.isProcessing && state.currentStep !== step.id}
          className={`flex items-center gap-2 px-4 py-2 whitespace-nowrap transition-all ${
            state.currentStep === step.id 
              ? 'text-sky-400 border-b-2 border-sky-400' 
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <step.icon size={18} />
          <span className="font-semibold">{step.label}</span>
        </button>
      ))}
    </div>
  );

  const renderCurrentStep = () => {
    switch (state.currentStep) {
      case AppStep.INPUT:
        return (
          <div className="max-w-3xl mx-auto space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="text-center space-y-4">
              <h1 className="text-5xl font-bold tracking-tight bg-gradient-to-r from-sky-400 to-blue-600 bg-clip-text text-transparent">
                유튜브 크리에이터 툴킷
              </h1>
              <p className="text-slate-400 text-lg">주제 하나로 조사부터 썸네일까지 한 번에 끝내세요.</p>
            </div>
            
            <form onSubmit={handleTopicSubmit} className="glass-panel p-8 rounded-3xl shadow-2xl space-y-6">
              <div className="space-y-2">
                <label className="text-sm font-semibold text-slate-300">영상 주제 (텍스트, 링크, 자료 등)</label>
                <textarea
                  value={state.topic}
                  onChange={(e) => updateState({ topic: e.target.value })}
                  placeholder="주제 입력 (예: 최근 한국 경제 상황, 삼성전자 갤럭시 신제품 리뷰, 뉴스 링크 등)"
                  className="w-full h-40 bg-slate-900/50 border border-slate-700 rounded-2xl p-4 focus:ring-2 focus:ring-sky-500 focus:border-transparent outline-none transition-all resize-none"
                  required
                />
              </div>

              <div className="grid grid-cols-3 gap-4">
                {(Object.keys(ScriptLength) as Array<keyof typeof ScriptLength>).map((len) => (
                  <button
                    key={len}
                    type="button"
                    onClick={() => updateState({ length: ScriptLength[len] })}
                    className={`py-3 rounded-xl border font-medium transition-all ${
                      state.length === ScriptLength[len]
                        ? 'bg-sky-500/10 border-sky-500 text-sky-400'
                        : 'border-slate-700 text-slate-400 hover:border-slate-500'
                    }`}
                  >
                    {len === 'SHORT' ? '단문 (4천자)' : len === 'MEDIUM' ? '중문 (8천자)' : '장문 (1.2만자)'}
                  </button>
                ))}
              </div>

              <button
                type="submit"
                disabled={state.isProcessing}
                className="w-full bg-sky-500 hover:bg-sky-600 disabled:bg-slate-700 text-white font-bold py-4 rounded-2xl shadow-lg shadow-sky-500/20 transition-all flex items-center justify-center gap-2 group"
              >
                {state.isProcessing ? (
                  <Loader2 className="animate-spin" />
                ) : (
                  <>
                    자동 제작 시작하기
                    <ChevronRight className="group-hover:translate-x-1 transition-transform" />
                  </>
                )}
              </button>
            </form>
          </div>
        );

      case AppStep.RESEARCH:
        return (
          <div className="max-w-4xl mx-auto space-y-6 animate-in fade-in duration-500">
            <h2 className="text-3xl font-bold flex items-center gap-3">
              <FileText className="text-sky-400" /> 조사 보고서 및 팩트체크
            </h2>
            <div className="glass-panel p-8 rounded-3xl space-y-6 leading-relaxed">
              <div className="prose prose-invert max-w-none whitespace-pre-wrap">
                {state.research?.report || "조사 중입니다..."}
              </div>
              {state.research?.sources && state.research.sources.length > 0 && (
                <div className="mt-8 pt-6 border-t border-slate-700">
                  <h3 className="text-lg font-bold mb-4">참고 문헌 / 출처</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {state.research.sources.map((source, i) => (
                      <a 
                        key={i} 
                        href={source.uri} 
                        target="_blank" 
                        rel="noopener noreferrer"
                        className="p-3 bg-slate-900/50 rounded-lg hover:bg-slate-800 transition-colors text-sky-400 truncate text-sm flex items-center gap-2"
                      >
                        <Search size={14} /> {source.title}
                      </a>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        );

      case AppStep.SCRIPT:
        return (
          <div className="max-w-5xl mx-auto space-y-8 animate-in fade-in duration-500">
            <div className="flex justify-between items-center">
              <h2 className="text-3xl font-bold flex items-center gap-3">
                <PlayCircle className="text-sky-400" /> 대본 및 Vrew TTS 최적화
              </h2>
              <button 
                onClick={() => {
                  navigator.clipboard.writeText(state.script?.ttsScript || '');
                  alert('클립보드에 복사되었습니다.');
                }}
                className="bg-slate-800 hover:bg-slate-700 px-4 py-2 rounded-xl flex items-center gap-2 transition-colors"
              >
                <Download size={18} /> TTS 전체 복사
              </button>
            </div>
            
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div className="space-y-4">
                <h3 className="text-xl font-semibold text-slate-300">원문 스토리텔링 대본</h3>
                <div className="glass-panel p-6 rounded-2xl h-[600px] overflow-y-auto whitespace-pre-wrap text-slate-300">
                  {state.script?.rawScript || "대본 생성 중..."}
                </div>
              </div>
              <div className="space-y-4">
                <h3 className="text-xl font-semibold text-sky-400">Vrew용 TTS 내레이션 (구어체)</h3>
                <div className="glass-panel p-6 rounded-2xl h-[600px] overflow-y-auto whitespace-pre-wrap text-sky-50 font-medium">
                  {state.script?.ttsScript || "변환 중..."}
                </div>
              </div>
            </div>
          </div>
        );

      case AppStep.IMAGES:
        return (
          <div className="max-w-6xl mx-auto space-y-8 animate-in fade-in duration-500">
            <div className="flex justify-between items-center">
              <h2 className="text-3xl font-bold flex items-center gap-3">
                <ImageIcon className="text-sky-400" /> 12개 주요 장면 이미지 구성
              </h2>
              <button 
                onClick={downloadAllImages}
                className="bg-sky-500 hover:bg-sky-600 px-6 py-2 rounded-xl flex items-center gap-2 transition-colors font-bold"
              >
                <Download size={18} /> 전체 이미지 다운로드
              </button>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {state.script?.paragraphs.map((p, idx) => (
                <div key={idx} className="glass-panel rounded-2xl overflow-hidden flex flex-col group border border-slate-700/50 hover:border-sky-500/50 transition-all">
                  <div className="aspect-video bg-slate-900 relative">
                    {p.imageUrl ? (
                      <>
                        <img src={p.imageUrl} alt={`Scene ${idx + 1}`} className="w-full h-full object-cover" />
                        <div className="absolute top-2 right-2 flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button 
                            onClick={() => retryImage(idx)}
                            className="p-2 bg-black/60 backdrop-blur-md rounded-lg text-white hover:bg-sky-500 transition-colors"
                          >
                            <RefreshCw size={16} className={p.isGenerating ? "animate-spin" : ""} />
                          </button>
                          <button 
                            onClick={() => downloadImage(p.imageUrl!, `scene_${idx + 1}.png`)}
                            className="p-2 bg-black/60 backdrop-blur-md rounded-lg text-white hover:bg-sky-500 transition-colors"
                          >
                            <Download size={16} />
                          </button>
                        </div>
                      </>
                    ) : (
                      <div className="flex items-center justify-center h-full text-slate-600 flex-col gap-3">
                        {p.isGenerating ? <Loader2 className="animate-spin text-sky-500" size={32} /> : <ImageIcon size={32} />}
                        <span className="text-sm">{p.isGenerating ? "이미지 생성 중..." : "이미지 준비 중"}</span>
                      </div>
                    )}
                  </div>
                  <div className="p-4 space-y-2 flex-grow">
                    <div className="flex items-center gap-2 mb-2">
                      <span className="bg-sky-500/20 text-sky-400 text-xs font-bold px-2 py-1 rounded">Scene {idx + 1}</span>
                    </div>
                    <p className="text-xs text-slate-400 line-clamp-3 leading-relaxed italic">"{p.content}"</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        );

      case AppStep.METADATA:
        return (
          <div className="max-w-4xl mx-auto space-y-8 animate-in fade-in duration-500">
            <h2 className="text-3xl font-bold flex items-center gap-3">
              <Hash className="text-sky-400" /> 유튜브 메타데이터 및 SEO
            </h2>
            
            <div className="grid gap-6">
              <div className="glass-panel p-6 rounded-2xl space-y-4">
                <h3 className="text-lg font-bold text-sky-400 border-b border-slate-700 pb-2">영상 설명란</h3>
                <div className="text-slate-300 whitespace-pre-wrap text-sm leading-relaxed h-48 overflow-y-auto bg-slate-900/50 p-4 rounded-xl">
                  {state.metadata?.youtubeDescription}
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="glass-panel p-6 rounded-2xl space-y-4">
                  <h3 className="text-lg font-bold text-sky-400 border-b border-slate-700 pb-2">핵심 4줄 요약</h3>
                  <div className="text-slate-300 text-sm italic leading-relaxed">
                    {state.metadata?.summary4Lines}
                  </div>
                </div>
                <div className="glass-panel p-6 rounded-2xl space-y-4">
                  <h3 className="text-lg font-bold text-sky-400 border-b border-slate-700 pb-2">해시태그</h3>
                  <div className="text-sky-500 font-medium">
                    {state.metadata?.hashtags.join(' ')}
                  </div>
                </div>
              </div>

              <div className="glass-panel p-6 rounded-2xl space-y-4">
                <h3 className="text-lg font-bold text-sky-400 border-b border-slate-700 pb-2">SEO 태그 (쉼표 구분)</h3>
                <div className="text-slate-400 text-xs font-mono tracking-tight bg-slate-900/50 p-4 rounded-xl">
                  {state.metadata?.seoKeywords.join(', ')}
                </div>
              </div>

              <div className="glass-panel p-6 rounded-2xl space-y-4">
                <h3 className="text-lg font-bold text-sky-400 border-b border-slate-700 pb-2">고정 댓글 및 인사말</h3>
                <div className="text-slate-300 text-sm bg-slate-900/50 p-4 rounded-xl border border-slate-700">
                  {state.metadata?.pinnedComment}
                </div>
              </div>
            </div>
          </div>
        );

      case AppStep.THUMBNAIL:
        return (
          <div className="max-w-5xl mx-auto space-y-8 animate-in fade-in duration-500">
            <h2 className="text-3xl font-bold flex items-center gap-3">
              <Layout className="text-sky-400" /> 썸네일 제안
            </h2>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              <div className="space-y-6">
                <div className="glass-panel rounded-3xl overflow-hidden shadow-2xl border border-slate-700">
                  <div className="aspect-video bg-slate-900 flex items-center justify-center relative">
                    {state.thumbnail?.pureImageUrl ? (
                      <img src={state.thumbnail.pureImageUrl} alt="Thumbnail background" className="w-full h-full object-cover" />
                    ) : (
                      <Loader2 className="animate-spin text-sky-500" />
                    )}
                    <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent flex flex-col justify-end p-8">
                      <p className="text-white text-2xl font-black drop-shadow-lg text-center leading-tight">
                        [디자인 가이드: 아래 추천 문구를 여기에 배치하세요]
                      </p>
                    </div>
                  </div>
                  <div className="p-4 bg-slate-800 flex justify-between items-center">
                    <span className="text-sm font-semibold text-slate-400">썸네일 배경 이미지</span>
                    {state.thumbnail?.pureImageUrl && (
                      <button 
                        onClick={() => downloadImage(state.thumbnail!.pureImageUrl!, 'thumbnail_bg.png')}
                        className="bg-sky-500 hover:bg-sky-600 p-2 rounded-lg text-white"
                      >
                        <Download size={18} />
                      </button>
                    )}
                  </div>
                </div>

                <div className="glass-panel p-6 rounded-3xl space-y-4">
                  <h3 className="text-lg font-bold text-yellow-400 flex items-center gap-2">
                    💡 썸네일 제작 팁
                  </h3>
                  <ul className="text-sm text-slate-400 space-y-2 list-disc pl-4">
                    <li>글자는 크고 가독성 좋게 (고딕 계열 추천)</li>
                    <li>중요한 키워드에는 형광색이나 원색으로 강조</li>
                    <li>배경 이미지의 핵심 피사체가 가려지지 않게 배치</li>
                  </ul>
                </div>
              </div>

              <div className="space-y-6">
                <div className="glass-panel p-6 rounded-3xl space-y-6">
                  <h3 className="text-xl font-bold text-sky-400 flex items-center gap-2">
                    <Search size={20} /> 추천 카피 (형태 1)
                  </h3>
                  <div className="space-y-3">
                    {state.thumbnail?.copySuggestions.type1.map((copy, i) => (
                      <div key={i} className="bg-slate-900/80 p-4 rounded-xl border border-slate-700 hover:border-sky-500/50 transition-colors cursor-pointer group">
                        <p className="text-slate-200 font-bold group-hover:text-white">{copy}</p>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="glass-panel p-6 rounded-3xl space-y-6">
                  <h3 className="text-xl font-bold text-sky-400 flex items-center gap-2">
                    <PlayCircle size={20} /> 추천 카피 (형태 2)
                  </h3>
                  <div className="space-y-3">
                    {state.thumbnail?.copySuggestions.type2.map((copy, i) => (
                      <div key={i} className="bg-slate-900/80 p-4 rounded-xl border border-slate-700 hover:border-sky-500/50 transition-colors cursor-pointer group">
                        <p className="text-slate-200 font-bold group-hover:text-white">{copy}</p>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <div className="min-h-screen bg-[#0f172a] text-slate-100 flex flex-col">
      {/* Header */}
      <header className="sticky top-0 z-50 glass-panel border-b border-slate-800 px-6 py-4 flex justify-between items-center">
        <div className="flex items-center gap-2 cursor-pointer" onClick={() => updateState({ currentStep: AppStep.INPUT })}>
          <div className="w-10 h-10 bg-sky-500 rounded-xl flex items-center justify-center shadow-lg shadow-sky-500/20">
            <PlayCircle className="text-white" />
          </div>
          <span className="text-xl font-black tracking-tighter">CREATOR AI</span>
        </div>
        
        {state.currentStep !== AppStep.INPUT && (
          <div className="flex items-center gap-4">
            <button 
              onClick={() => updateState({ currentStep: AppStep.INPUT })}
              className="px-4 py-2 text-slate-400 hover:text-white transition-colors"
            >
              새 프로젝트
            </button>
            <div className="flex items-center gap-2 bg-slate-800/50 px-3 py-1.5 rounded-full border border-slate-700">
              <div className={`w-2 h-2 rounded-full ${state.isProcessing ? 'bg-sky-500 animate-pulse' : 'bg-green-500'}`} />
              <span className="text-xs font-semibold text-slate-400">{state.isProcessing ? "작업 중" : "완료"}</span>
            </div>
          </div>
        )}
      </header>

      {/* Main Content */}
      <main className="flex-grow container mx-auto px-6 py-12">
        {state.currentStep !== AppStep.INPUT && renderStepNav()}
        {renderCurrentStep()}
      </main>

      {/* Global Status Bar (Footer) */}
      {state.isProcessing && (
        <div className="fixed bottom-0 left-0 right-0 glass-panel border-t border-sky-500/30 p-4 z-50 animate-in slide-in-from-bottom duration-300">
          <div className="container mx-auto flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Loader2 className="animate-spin text-sky-400" />
              <div className="space-y-1">
                <p className="text-sm font-bold text-sky-400">AI가 콘텐츠를 제작하고 있습니다...</p>
                <p className="text-xs text-slate-500">
                  {state.currentStep === AppStep.RESEARCH && "최신 정보를 조사하고 팩트를 체크하고 있습니다."}
                  {state.currentStep === AppStep.SCRIPT && "조사 결과를 바탕으로 몰입도 높은 대본을 작성 중입니다."}
                  {state.currentStep === AppStep.IMAGES && "각 장면별 초현실적 고품질 이미지를 생성하고 있습니다."}
                  {state.currentStep === AppStep.METADATA && "SEO 최적화를 위한 메타데이터를 추출하고 있습니다."}
                  {state.currentStep === AppStep.THUMBNAIL && "클릭을 부르는 썸네일 카피를 고민하고 있습니다."}
                </p>
              </div>
            </div>
            <div className="hidden md:flex gap-2">
               {/* Progress steps visualization could go here */}
            </div>
          </div>
        </div>
      )}

      {/* Footer Branding */}
      <footer className="py-8 border-t border-slate-800/50 text-center text-slate-500 text-sm">
        <p>© 2024 AI Creator All-in-one Toolkit. Built for professional YouTube workflow.</p>
      </footer>
    </div>
  );
}
