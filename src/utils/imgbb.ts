export async function uploadToImgBB(buffer: Buffer): Promise<string> {
    const key = process.env.IMGBB_API_KEY;
    if (!key) throw new Error("IMGBB_API_KEY is not set");

    const form = new FormData();
    form.append("image", buffer.toString("base64"));

    const res = await fetch(`https://api.imgbb.com/1/upload?key=${key}`, {
        method: "POST",
        body: form,
    });
    const json = (await res.json()) as { data?: { url?: string } };

    if (!res.ok || !json.data?.url) throw new Error("Image upload failed");
    return json.data.url;
}