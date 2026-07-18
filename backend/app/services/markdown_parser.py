import re
import frontmatter

class MarkdownParser:
    @staticmethod
    def parse_obsidian_links(text: str) -> list[str]:
        # Matches [[Link]] or [[Link|Alias]]
        pattern = r"\[\[(.*?)\]\]"
        links = []
        for match in re.finditer(pattern, text):
            link_content = match.group(1)
            # Split by | to get the actual link if it has an alias
            link = link_content.split('|')[0].strip()
            links.append(link)
        return list(set(links))

    @staticmethod
    def parse_tags(text: str) -> list[str]:
        # Matches #tag but not if it's part of a URL or preceded by a word character
        pattern = r"(?<![\w])#([\w\-\_]+)"
        tags = re.findall(pattern, text)
        return list(set(tags))

    @staticmethod
    def parse_frontmatter(text: str) -> tuple[dict, str]:
        try:
            parsed = frontmatter.loads(text)
            return parsed.metadata, parsed.content
        except Exception:
            return {}, text

    @classmethod
    def process_document(cls, text: str) -> dict:
        metadata, content = cls.parse_frontmatter(text)
        # Search for tags in both frontmatter 'tags' and inline
        inline_tags = cls.parse_tags(content)
        
        # Combine tags
        fm_tags = metadata.get("tags", [])
        if isinstance(fm_tags, str):
            fm_tags = [t.strip() for t in fm_tags.split(',')]
        
        all_tags = list(set(inline_tags + (fm_tags if isinstance(fm_tags, list) else [])))
        
        links = cls.parse_obsidian_links(content)
        
        return {
            "metadata": metadata,
            "content": content,
            "tags": all_tags,
            "links": links
        }
