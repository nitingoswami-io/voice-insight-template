import {
  BuildYourOwn,
  Concepts,
  Hero,
  Pipeline,
  Verification,
} from "@/components/landing/sections";

export default function Home() {
  return (
    <>
      <Hero />
      <Pipeline />
      <Concepts />
      <Verification />
      <BuildYourOwn />
    </>
  );
}
