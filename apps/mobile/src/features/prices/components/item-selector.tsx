import { useState } from 'react';
import { StyleSheet, View, Text, TouchableOpacity } from 'react-native';
import { TextInput } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Colors } from '../../../theme';

const MAX_ITEMS = 8;

const inputTheme = {
  colors: { onSurface: Colors.textPrimary, onSurfaceVariant: Colors.textSecondary },
};

interface ItemSelectorProps {
  items: string[];
  onItemsChange: (items: string[]) => void;
}

export function ItemSelector({ items, onItemsChange }: ItemSelectorProps) {
  const [text, setText] = useState('');

  const addItem = () => {
    const trimmed = text.trim();
    if (!trimmed || items.length >= MAX_ITEMS) return;
    if (items.some((i) => i.toLowerCase() === trimmed.toLowerCase())) return;
    onItemsChange([...items, trimmed]);
    setText('');
  };

  const removeItem = (index: number) => {
    onItemsChange(items.filter((_, i) => i !== index));
  };

  return (
    <View style={styles.container}>
      <View style={styles.inputRow}>
        <TextInput
          label="Add item"
          value={text}
          onChangeText={setText}
          onSubmitEditing={addItem}
          mode="outlined"
          autoCapitalize="none"
          style={[styles.input, styles.flex]}
          theme={inputTheme}
          returnKeyType="done"
        />
        <TouchableOpacity
          style={[styles.addBtn, items.length >= MAX_ITEMS && styles.addBtnDisabled]}
          onPress={addItem}
          disabled={items.length >= MAX_ITEMS || !text.trim()}
        >
          <MaterialCommunityIcons name="plus" size={20} color={Colors.bg} />
        </TouchableOpacity>
      </View>
      {items.length > 0 && (
        <View style={styles.chipRow}>
          {items.map((item, idx) => (
            <View key={item} style={styles.chip}>
              <Text style={styles.chipText}>{item}</Text>
              <TouchableOpacity onPress={() => removeItem(idx)} hitSlop={8}>
                <MaterialCommunityIcons name="close-circle" size={16} color={Colors.textSecondary} />
              </TouchableOpacity>
            </View>
          ))}
        </View>
      )}
      <Text style={styles.hint}>{items.length}/{MAX_ITEMS} items</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: 8,
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  input: {
    backgroundColor: Colors.surface,
    fontSize: 13,
    marginBottom: 0,
  },
  flex: {
    flex: 1,
  },
  addBtn: {
    backgroundColor: Colors.green,
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  addBtnDisabled: {
    opacity: 0.4,
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: Colors.surfaceHigh,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  chipText: {
    fontSize: 13,
    color: Colors.textPrimary,
  },
  hint: {
    fontSize: 11,
    color: Colors.textMuted,
  },
});
