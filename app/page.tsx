import AmbiShell from "@/components/AmbiShell";
import ImageGenerationBridge from "@/components/ImageGenerationBridge";
import VideoGenerationBridge from "@/components/VideoGenerationBridge";
import AudioGenerationBridge from "@/components/AudioGenerationBridge";

export default function Home() {
  return <><AmbiShell /><ImageGenerationBridge /><VideoGenerationBridge /><AudioGenerationBridge /></>;
}
