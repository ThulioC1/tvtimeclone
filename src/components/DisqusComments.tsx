import { DiscussionEmbed } from 'disqus-react';

const SHORTNAME = 'timetowatch';
const SITE_URL = 'https://timetowatch1.vercel.app';

interface Props {
  mediaId: number;
  mediaType: 'movie' | 'tv';
  title: string;
}

const DisqusComments = ({ mediaId, mediaType, title }: Props) => {
  const url = `${SITE_URL}/${mediaType === 'movie' ? 'movie' : 'show'}/${mediaId}`;
  const identifier = `${mediaType}-${mediaId}`;

  return (
    <div className="mt-8">
      <h2 className="section-title mb-4">Comentários</h2>
      <DiscussionEmbed
        shortname={SHORTNAME}
        config={{
          url,
          identifier,
          title,
          language: 'pt_BR',
        }}
      />
    </div>
  );
};

export default DisqusComments;
