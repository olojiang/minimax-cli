import { flushPromises, mount } from '@vue/test-utils';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import SpeechPanel from './SpeechPanel.vue';
import { cloneVoice, getVoices, synthesizeSpeech, uploadVoiceCloneFile } from '../api/client';

vi.mock('../api/client', () => ({
  checkQuota: vi.fn().mockResolvedValue({ model_remains: [] }),
  cloneVoice: vi.fn(),
  getVoices: vi.fn(),
  synthesizeSpeech: vi.fn(),
  uploadVoiceCloneFile: vi.fn(),
}));

vi.mock('../utils/fileExport', () => ({
  downloadMediaFromResponse: vi.fn(),
}));

vi.mock('../utils/localLibrary', () => ({
  saveLocalLibraryRecord: vi.fn().mockResolvedValue(null),
}));

describe('SpeechPanel.vue', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
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
