import { api } from "@/trpc/server";
import TemplateBuilder from "../TemplateBuilder";

export const metadata = { title: "Formify" };

export default async function NewTemplatePage() {
    const library = await api.block.listLibrary();
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-explicit-any
    const userBlocksAny = library.userBlocks as any;
    return (
        <TemplateBuilder
            systemBlocks={library.systemBlocks}
            // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
            userBlocks={userBlocksAny}
        />
    );
}