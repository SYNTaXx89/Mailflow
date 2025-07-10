import { useState } from 'react';
import { ComposerType, ComposerData } from '../types/index';

export const useEmailComposer = () => {
  const [showComposer, setShowComposer] = useState(false);
  const [composerType, setComposerType] = useState<ComposerType>('reply');
  const [composerData, setComposerData] = useState<ComposerData>({
    to: '',
    subject: '',
    body: '',
    attachments: []
  });

  const applyFormatting = (command: string): void => {
    document.execCommand(command, false);
  };

  const resetComposer = (): void => {
    setComposerData({ to: '', subject: '', body: '', attachments: [] });
    setShowComposer(false);
  };

  const openComposer = (type: ComposerType, data: ComposerData): void => {
    setComposerType(type);
    setComposerData(data);
    setShowComposer(true);
  };

  return {
    showComposer,
    setShowComposer,
    composerType,
    setComposerType,
    composerData,
    setComposerData,
    applyFormatting,
    resetComposer,
    openComposer
  };
};