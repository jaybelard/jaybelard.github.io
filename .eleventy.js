import mditfn from "markdown-it-footnote";

export default async function (eleventyConfig) {
	eleventyConfig.amendLibrary("md", (mdLib) => mdLib.use(mditfn));
	eleventyConfig.addPassthroughCopy({"_static": "/"})
}

export const config = {
	dir: {
		input: "views",
		includes: "../_includes",
	},
};
