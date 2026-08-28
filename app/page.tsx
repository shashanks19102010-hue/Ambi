import AmbiShell from "@/components/AmbiShell";
import ImageGenerationBridge from "@/components/ImageGenerationBridge";
import VideoGenerationBridge from "@/components/VideoGenerationBridge";
import PexelsSearchBridge from "@/components/PexelsSearchBridge";

export default function Home() {
  return <><AmbiShell /><ImageGenerationBridge /><VideoGenerationBridge /><PexelsSearchBridge /></>;
}
