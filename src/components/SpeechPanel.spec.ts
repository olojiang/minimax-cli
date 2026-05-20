import { flushPromises, mount } from '@vue/test-utils';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import SpeechPanel from './SpeechPanel.vue';
import { cloneVoice, getVoices, synthesizeSpeech, uploadVoiceCloneFile } from '../api/client';
import { loadLocalLibraryRecords, saveLocalLibraryRecord } from '../utils/localLibrary';

vi.mock('../api/client', () => ({
  checkQuota: vi.fn().mockResolvedValue({ model_remains: [] }),
  cloneVoice: vi.fn(),
  getVoices: vi.fn(),
  synthesizeSpeech: vi.fn(),
  uploadVoiceCloneFile: vi.fn(),
}));

vi.mock('../utils/fileExport', () => ({
  buildMediaObjectUrlFromHex: vi.fn(() => 'blob:mock-speech'),
  downloadMediaFromResponse: vi.fn(),
}));

vi.mock('../utils/localLibrary', () => ({
  deleteLocalLibraryRecord: vi.fn().mockResolvedValue(true),
  loadLocalLibraryRecords: vi.fn().mockResolvedValue([]),
  saveLocalLibraryRecord: vi.fn().mockResolvedValue(null),
}));

describe('SpeechPanel.vue', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    (loadLocalLibraryRecords as any).mockResolvedValue([]);
    (saveLocalLibraryRecord as any).mockResolvedValue(null);
    vi.spyOn(window.HTMLMediaElement.prototype, 'play').mockResolvedValue(undefined);
  });

  it('submits speech text with selected options', async () => {
    (synthesizeSpeech as any).mockResolvedValue({ data: { audio: 'a'.repeat(40) } });
    const wrapper = mount(SpeechPanel);

    await wrapper.find('textarea').setValue('你好 MiniMax');
    await wrapper.find('#speech-model').setValue('speech-2.8-turbo');
    await wrapper.find('.voice-id-input').setValue('voice-test');
    await wrapper.find('#speech-speed').setValue('1.2');
    await wrapper.find('.btn').trigger('click');
    await flushPromises();

    expect(synthesizeSpeech).toHaveBeenCalledWith('你好 MiniMax', expect.objectContaining({
      model: 'speech-2.8-turbo',
      voiceId: 'voice-test',
      speed: 1.2,
      format: 'mp3',
    }));
    expect(saveLocalLibraryRecord).toHaveBeenCalledWith(
      'speech',
      '你好 MiniMax',
      expect.objectContaining({
        mmxPanel: 'speech',
        text: '你好 MiniMax',
      }),
    );
    expect(wrapper.find('.speech-library audio').attributes('src')).toBe('blob:mock-speech');
    expect(wrapper.find('.result-box pre').exists()).toBe(false);

    await wrapper.find('.result-toggle').trigger('click');

    expect(wrapper.find('.result-box pre').text()).toContain('"audio"');
  });

  it('renders the generated audio before the local library save finishes', async () => {
    let resolveSave: (value: unknown) => void = () => {};
    (synthesizeSpeech as any).mockResolvedValue({ data: { audio: 'b'.repeat(40) } });
    (saveLocalLibraryRecord as any).mockReturnValue(new Promise((resolve) => {
      resolveSave = resolve;
    }));
    const wrapper = mount(SpeechPanel);

    await wrapper.find('textarea').setValue('立即播放');
    await wrapper.find('.btn').trigger('click');
    await flushPromises();

    expect(wrapper.find('.speech-library audio').attributes('src')).toBe('blob:mock-speech');
    expect(wrapper.text()).toContain('立即播放');

    resolveSave(null);
    await flushPromises();
  });

  it('restores speech result history from the local library after refresh', async () => {
    (loadLocalLibraryRecords as any).mockResolvedValue([
      {
        id: 'speech-record',
        kind: 'audio',
        prompt: '刷新后仍然可以播放',
        response: {
          mmxPanel: 'speech',
          options: {
            voiceId: 'female-shaonv',
            model: 'speech-2.8-hd',
            format: 'mp3',
          },
          result: { data: { audio: 'a'.repeat(40) } },
        },
        media: [
          {
            source: 'a'.repeat(40),
            file: 'audio/speech-record-1.mp3',
            url: '/local-library/files/audio/speech-record-1.mp3',
            mime: 'audio/mpeg',
          },
        ],
        createdAt: new Date().toISOString(),
      },
      {
        id: 'music-record',
        kind: 'audio',
        prompt: '音乐记录不应出现在语音列表',
        response: {
          lyrics: '',
          data: { audio: 'b'.repeat(40) },
        },
        media: [
          {
            source: 'b'.repeat(40),
            file: 'audio/music-record-1.mp3',
            url: '/local-library/files/audio/music-record-1.mp3',
            mime: 'audio/mpeg',
          },
        ],
        createdAt: new Date().toISOString(),
      },
    ]);
    const wrapper = mount(SpeechPanel);
    await flushPromises();

    expect(wrapper.findAll('.speech-item')).toHaveLength(1);
    expect(wrapper.text()).toContain('刷新后仍然可以播放');
    expect(wrapper.text()).not.toContain('音乐记录不应出现在语音列表');
    expect(wrapper.find('.speech-library audio').attributes('src')).toBe('/local-library/files/audio/speech-record-1.mp3');

    await wrapper.find('.speech-item').trigger('click');

    expect(window.HTMLMediaElement.prototype.play).toHaveBeenCalled();
  });

  it('refreshes available voices', async () => {
    (getVoices as any).mockResolvedValue({
      system_voice: [
        { voice_id: 'voice-a', voice_name: 'Voice A' }
      ],
      voice_cloning: [],
      voice_generation: [],
    });
    const wrapper = mount(SpeechPanel);

    await wrapper.find('.secondary-btn').trigger('click');
    await flushPromises();

    expect(getVoices).toHaveBeenCalledWith('all');
    expect((wrapper.find('#speech-voice').element as HTMLSelectElement).value).toBe('voice-a');
  });

  it('searches and selects famous quotes for speech input', async () => {
    const wrapper = mount(SpeechPanel);

    await wrapper.find('#quote-search').setValue('知行合一');
    await wrapper.find('.quote-item').trigger('click');

    expect((wrapper.find('#speech-text').element as HTMLTextAreaElement).value).toBe('知是行之始，行是知之成。');
  });

  it('uploads and clones a voice file', async () => {
    (uploadVoiceCloneFile as any).mockResolvedValue({ file: { file_id: 123 } });
    (cloneVoice as any).mockResolvedValue({ voice_id: 'custom-voice' });
    const wrapper = mount(SpeechPanel);
    const file = new File(['audio'], 'voice.mp3', { type: 'audio/mpeg' });

    await wrapper.find('.clone-section').trigger('click');
    await wrapper.find('#clone-voice-id').setValue('custom-voice');
    const input = wrapper.find('#clone-file');
    Object.defineProperty(input.element, 'files', {
      value: [file],
      configurable: true
    });
    await input.trigger('change');
    await wrapper.find('.clone-btn').trigger('click');
    await flushPromises();

    expect(uploadVoiceCloneFile).toHaveBeenCalledWith(file);
    expect(cloneVoice).toHaveBeenCalledWith(expect.objectContaining({
      fileId: 123,
      voiceId: 'custom-voice',
      needNoiseReduction: true,
      needVolumeNormalization: true,
    }));
    expect(wrapper.text()).toContain('音色已克隆：custom-voice');
  });
});
