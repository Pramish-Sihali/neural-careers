import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  await prisma.job.deleteMany();

  await prisma.job.createMany({
    data: [
      {
        title: "AI Product Operator",
        team: "Product",
        location: "San Francisco, CA",
        remote: true,
        experienceLevel: "Mid-Senior",
        description:
          "Join Niural's product team to design, deploy, and optimize AI-powered workflows across our hiring and onboarding platform. You'll work at the intersection of product management and AI engineering.",
        responsibilities:
          "• Own end-to-end AI feature development from prompt design to production\n• Collaborate with engineering to ship LLM-backed features\n• Define evaluation metrics for AI output quality\n• Iterate on prompts based on user feedback and performance data\n• Build internal tooling for monitoring AI pipelines",
        requirements:
          "• 3+ years in product management or AI/ML engineering\n• Strong understanding of LLM capabilities and limitations\n• Experience with API integrations and data pipelines\n• Excellent written and verbal communication\n• Bonus: experience with Anthropic, OpenAI, or Gemini APIs",
        isActive: true,
      },
      {
        title: "Senior Full-Stack Engineer",
        team: "Engineering",
        location: "New York, NY",
        remote: true,
        experienceLevel: "Senior",
        description:
          "Build the core platform that powers Niural's candidate experience — from application submission to day-one onboarding. Work with Next.js, TypeScript, Supabase, and cutting-edge AI APIs.",
        responsibilities:
          "• Design and implement full-stack features across the hiring pipeline\n• Own database schema design and query optimization\n• Build real-time features with webhooks and server-sent events\n• Review code and mentor junior engineers\n• Contribute to architecture decisions",
        requirements:
          "• 5+ years of full-stack experience\n• Expert-level TypeScript and React\n• Production experience with PostgreSQL\n• Familiarity with Next.js App Router\n• Strong understanding of REST API design",
        isActive: true,
      },
      {
        title: "Talent Operations Specialist",
        team: "People Operations",
        location: "Remote",
        remote: true,
        experienceLevel: "Junior",
        description:
          "Support Niural's rapid growth by managing candidate pipelines, coordinating interviews, and improving our hiring operations with AI-assisted tools.",
        responsibilities:
          "• Manage candidate communications throughout the hiring process\n• Schedule and coordinate interviews across time zones\n• Maintain ATS hygiene and reporting dashboards\n• Identify and implement process improvements\n• Assist with onboarding logistics for new hires",
        requirements:
          "• 1–2 years in recruiting coordination or HR operations\n• Strong organizational skills and attention to detail\n• Comfortable with G Suite, Slack, and ATS tools\n• Data-driven mindset\n• Bonus: experience with AI tools for productivity",
        isActive: true,
      },
    ],
  });

  console.log("✅ Seeded 3 jobs");
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
