import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { PiArrowLeft, PiArrowUpRight } from "react-icons/pi";
import { PostGallery } from "@/components/blog/PostGallery";
import { formatDate, getPost, getPosts, renderPostParts } from "@/lib/posts";

type Props = { params: Promise<{ slug: string }> };

export const dynamicParams = false;

export function generateStaticParams() {
  return getPosts().map((p) => ({ slug: p.slug }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const post = getPost((await params).slug);
  return post ? { title: post.title, description: post.summary } : {};
}

/**
 * One post, set for reading: a display title, then the text on the left (18px within a
 * 65-character measure) and the pictures in their own column on the right, each opening large.
 */
export default async function PostPage({ params }: Props) {
  const post = getPost((await params).slug);
  if (!post) notFound();
  const { html, images } = renderPostParts(post);

  return (
    <article className="pb-12">
      <Link href="/blog" className="link inline-flex items-center gap-1.5 text-base">
        <PiArrowLeft aria-hidden className="size-4" />
        All posts
      </Link>

      <header className="mt-10 md:mt-14">
        <h1 className="post-heading" data-split="chars">
          {post.title}
        </h1>
      </header>
      <p className="mt-6 flex flex-wrap gap-x-4 gap-y-1 text-base text-muted">
        <time dateTime={post.date}>{formatDate(post.date)}</time>
        {post.linkedin && (
          <a href={post.linkedin} target="_blank" rel="noopener noreferrer" className="link inline-flex items-center gap-1">
            First posted on LinkedIn
            <PiArrowUpRight aria-hidden data-nudge="out" className="size-4" />
            <span className="sr-only"> (opens in a new tab)</span>
          </a>
        )}
      </p>

      <div className="post-layout mt-12">
        <div className="post-body" dangerouslySetInnerHTML={{ __html: html }} />
        <PostGallery images={images} />
      </div>
    </article>
  );
}
